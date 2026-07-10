use serde::Serialize;
use std::{
    collections::{BTreeMap, HashMap},
    fs,
    path::{Path, PathBuf},
};

use crate::content::CollectionSummary;

const FRONTMATTER_SAMPLE_LIMIT: usize = 25;

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CollectionSchema {
    pub source: SchemaSource,
    pub fields: Vec<FieldSchema>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SchemaSource {
    ContentConfig,
    FrontmatterInference,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FieldSchema {
    pub name: String,
    pub field_type: FieldType,
    pub required: bool,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FieldType {
    String,
    Number,
    Boolean,
    Date,
    Array,
    Image,
    Unknown,
}

#[derive(Debug)]
pub struct SchemaDetectionResult {
    pub config_path: Option<PathBuf>,
    pub schemas_by_collection: HashMap<String, CollectionSchema>,
    pub warnings: Vec<String>,
}

pub fn detect_collection_schemas(
    project_path: &Path,
    collections: &[CollectionSummary],
) -> SchemaDetectionResult {
    let config_path = find_content_config(project_path);
    let mut warnings = Vec::new();
    let mut schemas_by_collection = HashMap::new();

    if let Some(config_path) = &config_path {
        match fs::read_to_string(config_path) {
            Ok(config_source) => {
                let detected = parse_content_config(&config_source);
                warnings.extend(detected.warnings);
                schemas_by_collection.extend(detected.schemas_by_collection);
            }
            Err(_) => warnings.push(format!(
                "Could not read {}. Schema detection will fall back to frontmatter where possible.",
                display_project_path(project_path, config_path)
            )),
        }
    }

    for collection in collections {
        if schemas_by_collection
            .get(&collection.name)
            .is_some_and(|schema| !schema.fields.is_empty())
        {
            continue;
        }

        if schemas_by_collection.contains_key(&collection.name) {
            schemas_by_collection.remove(&collection.name);
        }

        if let Some(schema) = infer_schema_from_frontmatter(collection) {
            schemas_by_collection.insert(collection.name.clone(), schema);
        }
    }

    SchemaDetectionResult {
        config_path,
        schemas_by_collection,
        warnings,
    }
}

fn find_content_config(project_path: &Path) -> Option<PathBuf> {
    find_file_with_stem(project_path, "content.config")
        .or_else(|| find_file_with_stem(&project_path.join("src"), "content.config"))
}

fn find_file_with_stem(directory: &Path, stem: &str) -> Option<PathBuf> {
    let entries = fs::read_dir(directory).ok()?;

    entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| {
            path.is_file()
                && path
                    .file_stem()
                    .and_then(|file_stem| file_stem.to_str())
                    .is_some_and(|file_stem| file_stem == stem)
        })
}

#[derive(Debug)]
struct ParsedContentConfig {
    schemas_by_collection: HashMap<String, CollectionSchema>,
    warnings: Vec<String>,
}

fn parse_content_config(source: &str) -> ParsedContentConfig {
    let masked = mask_comments_and_strings(source);
    let definitions = parse_collection_definitions(source, &masked);
    let mut warnings = Vec::new();
    let mut schemas_by_collection = HashMap::new();

    let Some(collections_object) = find_collections_export_object(source, &masked) else {
        warnings.push(
            "content.config.* does not export a collections object that Orbit Editor can read."
                .to_string(),
        );
        return ParsedContentConfig {
            schemas_by_collection,
            warnings,
        };
    };

    for property in split_top_level_properties(collections_object) {
        let Some((collection_name, value)) = parse_object_property(property) else {
            continue;
        };

        let collection_config = if value == collection_name {
            definitions.get(value).copied()
        } else if let Some(inline_config) = extract_define_collection_config(value) {
            Some(inline_config)
        } else {
            definitions.get(value).copied()
        };

        let Some(collection_config) = collection_config else {
            warnings.push(format!(
                "{collection_name} collection is defined through an unsupported expression, so Orbit Editor will infer fields from frontmatter if possible."
            ));
            continue;
        };

        match parse_collection_schema(&collection_name, collection_config) {
            Some(schema) => {
                schemas_by_collection.insert(collection_name.to_string(), schema);
            }
            None => warnings.push(format!(
                "{collection_name} schema is missing, imported, or defined through a function shape Orbit Editor does not understand yet. Orbit Editor will infer fields from frontmatter if possible."
            )),
        }
    }

    ParsedContentConfig {
        schemas_by_collection,
        warnings,
    }
}

fn parse_collection_definitions<'a>(source: &'a str, masked: &'a str) -> HashMap<&'a str, &'a str> {
    let mut definitions = HashMap::new();
    let mut search_start = 0;

    while let Some(relative_index) = masked[search_start..].find("defineCollection") {
        let define_index = search_start + relative_index;
        if let Some((name_start, name_end)) = find_variable_name_before_define(masked, define_index)
        {
            if let Some(config) = extract_define_collection_config(&source[define_index..]) {
                definitions.insert(&source[name_start..name_end], config);
            }
        }

        search_start = define_index + "defineCollection".len();
    }

    definitions
}

fn find_variable_name_before_define(masked: &str, define_index: usize) -> Option<(usize, usize)> {
    let before = &masked[..define_index];
    let equals_index = before.rfind('=')?;

    let mut name_end = equals_index;
    while name_end > 0 && before.as_bytes()[name_end - 1].is_ascii_whitespace() {
        name_end -= 1;
    }

    let mut name_start = name_end;
    while name_start > 0 {
        let character = before[..name_start].chars().next_back()?;
        if !is_identifier_character(character) {
            break;
        }
        name_start -= character.len_utf8();
    }

    if name_start == name_end {
        return None;
    }

    let prefix = before[..name_start].trim_end();
    if ["const", "let", "var"]
        .iter()
        .any(|keyword| prefix.ends_with(keyword))
    {
        Some((name_start, name_end))
    } else {
        None
    }
}

fn extract_define_collection_config(source_from_define: &str) -> Option<&str> {
    let masked = mask_comments_and_strings(source_from_define);
    let call_start = masked.find("defineCollection")?;
    let open_paren = find_next_byte(&masked, call_start, b'(')?;
    let close_paren = find_matching_delimiter(&masked, open_paren, b'(', b')')?;
    let arguments = &source_from_define[open_paren + 1..close_paren];
    let masked_arguments = &masked[open_paren + 1..close_paren];
    let object_start = masked_arguments.find('{')?;
    let object_end = find_matching_delimiter(masked_arguments, object_start, b'{', b'}')?;

    Some(&arguments[object_start..=object_end])
}

fn find_collections_export_object<'a>(source: &'a str, masked: &'a str) -> Option<&'a str> {
    let mut search_start = 0;

    while let Some(relative_index) = masked[search_start..].find("collections") {
        let collections_index = search_start + relative_index;
        let before = &masked[..collections_index];
        let recent_prefix = before
            .rsplit_once(|character| character == ';' || character == '\n' || character == '\r')
            .map(|(_, prefix)| prefix)
            .unwrap_or(before);

        if !recent_prefix.contains("export") {
            search_start = collections_index + "collections".len();
            continue;
        }

        let after = &masked[collections_index + "collections".len()..];
        let equals_offset = after.find('=')?;
        let object_offset = find_next_byte(after, equals_offset, b'{')
            .map(|offset| offset + collections_index + "collections".len())?;
        let object_end = find_matching_delimiter(masked, object_offset, b'{', b'}')?;

        return Some(&source[object_offset..=object_end]);
    }

    None
}

fn parse_collection_schema(
    collection_name: &str,
    collection_config: &str,
) -> Option<CollectionSchema> {
    let schema_expression = find_object_property_value(collection_config, "schema")?;
    let schema_expression = schema_expression.trim();

    if schema_expression.contains("=>") || !schema_expression.contains("z.object") {
        return None;
    }

    let object_body = extract_z_object_body(schema_expression)?;
    let mut fields = Vec::new();
    let mut warnings = Vec::new();

    for property in split_top_level_properties(object_body) {
        let Some((field_name, expression)) = parse_object_property(property) else {
            continue;
        };

        let field_type = detect_field_type(expression);
        if field_type == FieldType::Unknown {
            warnings.push(format!(
                "{collection_name}.{field_name} uses a schema shape Orbit Editor does not fully understand yet. It will be treated as an unknown field."
            ));
        }

        fields.push(FieldSchema {
            name: field_name.to_string(),
            field_type,
            required: !is_optional_expression(expression),
        });
    }

    if fields.is_empty() {
        return None;
    }

    fields.sort_by(|left, right| left.name.cmp(&right.name));

    Some(CollectionSchema {
        source: SchemaSource::ContentConfig,
        fields,
        warnings,
    })
}

fn find_object_property_value<'a>(object_source: &'a str, property_name: &str) -> Option<&'a str> {
    split_top_level_properties(strip_wrapping_braces(object_source))
        .into_iter()
        .filter_map(parse_object_property)
        .find_map(|(name, value)| (name == property_name).then_some(value))
}

fn extract_z_object_body(expression: &str) -> Option<&str> {
    let masked = mask_comments_and_strings(expression);
    let object_index = masked.find("z.object")?;
    let open_paren = find_next_byte(&masked, object_index, b'(')?;
    let close_paren = find_matching_delimiter(&masked, open_paren, b'(', b')')?;
    let arguments = &expression[open_paren + 1..close_paren];
    let masked_arguments = &masked[open_paren + 1..close_paren];
    let open_brace = masked_arguments.find('{')?;
    let close_brace = find_matching_delimiter(masked_arguments, open_brace, b'{', b'}')?;

    Some(&arguments[open_brace + 1..close_brace])
}

fn detect_field_type(expression: &str) -> FieldType {
    let compact = expression.split_whitespace().collect::<String>();

    if compact.contains("z.array(") || compact.contains(".array(") {
        FieldType::Array
    } else if compact.contains("image(") {
        FieldType::Image
    } else if compact.contains("z.coerce.date(") || compact.contains("z.date(") {
        FieldType::Date
    } else if compact.contains("z.coerce.number(") || compact.contains("z.number(") {
        FieldType::Number
    } else if compact.contains("z.coerce.boolean(") || compact.contains("z.boolean(") {
        FieldType::Boolean
    } else if compact.contains("z.string(")
        || compact.contains("z.url(")
        || compact.contains("z.email(")
        || compact.contains("reference(")
    {
        FieldType::String
    } else {
        FieldType::Unknown
    }
}

fn is_optional_expression(expression: &str) -> bool {
    let compact = expression.split_whitespace().collect::<String>();
    compact.contains(".optional(") || compact.contains(".nullish(") || compact.contains(".default(")
}

fn infer_schema_from_frontmatter(collection: &CollectionSummary) -> Option<CollectionSchema> {
    let sample_count = collection.entries.len().min(FRONTMATTER_SAMPLE_LIMIT);
    if sample_count == 0 {
        return None;
    }

    let mut field_stats: BTreeMap<String, InferredFieldStats> = BTreeMap::new();
    let mut files_read = 0;

    for entry in collection.entries.iter().take(FRONTMATTER_SAMPLE_LIMIT) {
        let Ok(contents) = fs::read_to_string(&entry.file_path) else {
            continue;
        };

        files_read += 1;

        for (name, field_type) in parse_frontmatter_fields(&contents) {
            field_stats
                .entry(name)
                .or_insert_with(InferredFieldStats::default)
                .record(field_type);
        }
    }

    if files_read == 0 || field_stats.is_empty() {
        return None;
    }

    let mut warnings = Vec::new();
    if collection.entries.len() > FRONTMATTER_SAMPLE_LIMIT {
        warnings.push(format!(
            "{} schema was inferred from the first {FRONTMATTER_SAMPLE_LIMIT} entries.",
            collection.name
        ));
    }

    let fields = field_stats
        .into_iter()
        .map(|(name, stats)| FieldSchema {
            name,
            field_type: stats.field_type,
            required: stats.count == files_read,
        })
        .collect::<Vec<_>>();

    Some(CollectionSchema {
        source: SchemaSource::FrontmatterInference,
        fields,
        warnings,
    })
}

#[derive(Debug)]
struct InferredFieldStats {
    count: usize,
    field_type: FieldType,
}

impl Default for InferredFieldStats {
    fn default() -> Self {
        Self {
            count: 0,
            field_type: FieldType::Unknown,
        }
    }
}

impl InferredFieldStats {
    fn record(&mut self, field_type: FieldType) {
        self.count += 1;
        self.field_type = match (self.field_type, field_type) {
            (FieldType::Unknown, next_type) => next_type,
            (current_type, next_type) if current_type == next_type => current_type,
            _ => FieldType::Unknown,
        };
    }
}

fn parse_frontmatter_fields(contents: &str) -> Vec<(String, FieldType)> {
    let Some(frontmatter) = extract_frontmatter(contents) else {
        return Vec::new();
    };

    let lines = frontmatter.lines().collect::<Vec<_>>();
    let mut fields = Vec::new();
    let mut index = 0;

    while index < lines.len() {
        let line = lines[index];

        if line.trim().is_empty() || line.trim_start().starts_with('#') || is_indented(line) {
            index += 1;
            continue;
        }

        let Some((name, value)) = line.split_once(':') else {
            index += 1;
            continue;
        };

        let name = name.trim();
        if name.is_empty() {
            index += 1;
            continue;
        }

        let value = value.trim();
        let mut field_type = infer_value_type(value);

        if value.is_empty() && has_following_array_item(&lines, index + 1) {
            field_type = FieldType::Array;
        }

        fields.push((name.to_string(), field_type));
        index += 1;
    }

    fields
}

fn extract_frontmatter(contents: &str) -> Option<&str> {
    let contents = contents.strip_prefix("---")?;
    let contents = contents
        .strip_prefix("\r\n")
        .or_else(|| contents.strip_prefix('\n'))?;
    let end_index = contents
        .find("\n---")
        .or_else(|| contents.find("\r\n---"))?;

    Some(&contents[..end_index])
}

fn has_following_array_item(lines: &[&str], start_index: usize) -> bool {
    lines
        .iter()
        .skip(start_index)
        .take_while(|line| line.trim().is_empty() || is_indented(line))
        .any(|line| line.trim_start().starts_with("- "))
}

fn infer_value_type(value: &str) -> FieldType {
    let value = value.trim().trim_matches('"').trim_matches('\'');

    if value.starts_with('[') && value.ends_with(']') {
        FieldType::Array
    } else if value.eq_ignore_ascii_case("true") || value.eq_ignore_ascii_case("false") {
        FieldType::Boolean
    } else if value.parse::<f64>().is_ok() {
        FieldType::Number
    } else if looks_like_date(value) {
        FieldType::Date
    } else {
        FieldType::String
    }
}

fn looks_like_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() >= 10
        && bytes.get(4) == Some(&b'-')
        && bytes.get(7) == Some(&b'-')
        && bytes[..4].iter().all(u8::is_ascii_digit)
        && bytes[5..7].iter().all(u8::is_ascii_digit)
        && bytes[8..10].iter().all(u8::is_ascii_digit)
}

fn is_indented(line: &str) -> bool {
    line.starts_with(' ') || line.starts_with('\t')
}

fn parse_object_property(property: &str) -> Option<(&str, &str)> {
    let property = trim_leading_comment_lines(property)
        .trim()
        .trim_end_matches(',');
    if property.is_empty() || property.starts_with("...") {
        return None;
    }

    if let Some((name, value)) = split_property_at_top_level_colon(property) {
        let name = normalize_property_name(name)?;
        return Some((name, value.trim()));
    }

    let name = normalize_property_name(property)?;
    Some((name, name))
}

fn trim_leading_comment_lines(property: &str) -> &str {
    let mut remaining = property.trim_start();

    loop {
        if remaining.starts_with("//") {
            let Some(newline_index) = remaining.find('\n') else {
                return "";
            };
            remaining = remaining[newline_index + 1..].trim_start();
            continue;
        }

        if remaining.starts_with("/*") {
            let Some(comment_end) = remaining.find("*/") else {
                return "";
            };
            remaining = remaining[comment_end + 2..].trim_start();
            continue;
        }

        return remaining;
    }
}

fn split_property_at_top_level_colon(property: &str) -> Option<(&str, &str)> {
    let masked = mask_comments_and_strings(property);
    let bytes = masked.as_bytes();
    let mut braces = 0;
    let mut brackets = 0;
    let mut parentheses = 0;

    for (index, byte) in bytes.iter().enumerate() {
        match byte {
            b'{' => braces += 1,
            b'}' => braces -= 1,
            b'[' => brackets += 1,
            b']' => brackets -= 1,
            b'(' => parentheses += 1,
            b')' => parentheses -= 1,
            b':' if braces == 0 && brackets == 0 && parentheses == 0 => {
                return Some((&property[..index], &property[index + 1..]));
            }
            _ => {}
        }
    }

    None
}

fn normalize_property_name(name: &str) -> Option<&str> {
    let name = name.trim();
    let name = name
        .strip_prefix('"')
        .and_then(|name| name.strip_suffix('"'))
        .or_else(|| {
            name.strip_prefix('\'')
                .and_then(|name| name.strip_suffix('\''))
        })
        .unwrap_or(name)
        .trim();

    if name.is_empty()
        || name
            .chars()
            .any(|character| !(is_identifier_character(character) || character == '-'))
    {
        None
    } else {
        Some(name)
    }
}

fn split_top_level_properties(object_body: &str) -> Vec<&str> {
    let object_body = strip_wrapping_braces(object_body);
    let masked = mask_comments_and_strings(object_body);
    let bytes = masked.as_bytes();
    let mut properties = Vec::new();
    let mut start = 0;
    let mut braces = 0;
    let mut brackets = 0;
    let mut parentheses = 0;

    for (index, byte) in bytes.iter().enumerate() {
        match byte {
            b'{' => braces += 1,
            b'}' => braces -= 1,
            b'[' => brackets += 1,
            b']' => brackets -= 1,
            b'(' => parentheses += 1,
            b')' => parentheses -= 1,
            b',' if braces == 0 && brackets == 0 && parentheses == 0 => {
                properties.push(object_body[start..index].trim());
                start = index + 1;
            }
            _ => {}
        }
    }

    if start < object_body.len() {
        properties.push(object_body[start..].trim());
    }

    properties
        .into_iter()
        .filter(|property| !property.is_empty())
        .collect()
}

fn strip_wrapping_braces(source: &str) -> &str {
    let source = source.trim();
    if source.starts_with('{') && source.ends_with('}') {
        &source[1..source.len() - 1]
    } else {
        source
    }
}

fn mask_comments_and_strings(source: &str) -> String {
    let bytes = source.as_bytes();
    let mut output = String::with_capacity(source.len());
    let mut index = 0;

    while index < bytes.len() {
        match bytes[index] {
            b'\'' | b'"' | b'`' => {
                let quote = bytes[index];
                output.push(' ');
                index += 1;

                while index < bytes.len() {
                    if bytes[index] == b'\\' {
                        output.push(' ');
                        index += 1;
                        if index < bytes.len() {
                            output.push(' ');
                            index += 1;
                        }
                        continue;
                    }

                    output.push(' ');
                    if bytes[index] == quote {
                        index += 1;
                        break;
                    }
                    index += 1;
                }
            }
            b'/' if bytes.get(index + 1) == Some(&b'/') => {
                output.push(' ');
                output.push(' ');
                index += 2;
                while index < bytes.len() && bytes[index] != b'\n' {
                    output.push(' ');
                    index += 1;
                }
            }
            b'/' if bytes.get(index + 1) == Some(&b'*') => {
                output.push(' ');
                output.push(' ');
                index += 2;
                while index < bytes.len() {
                    output.push(if bytes[index] == b'\n' { '\n' } else { ' ' });
                    if bytes[index] == b'*' && bytes.get(index + 1) == Some(&b'/') {
                        output.push(' ');
                        index += 2;
                        break;
                    }
                    index += 1;
                }
            }
            byte => {
                output.push(byte as char);
                index += 1;
            }
        }
    }

    output
}

fn find_next_byte(source: &str, start: usize, byte: u8) -> Option<usize> {
    source.as_bytes()[start..]
        .iter()
        .position(|candidate| *candidate == byte)
        .map(|offset| start + offset)
}

fn find_matching_delimiter(
    source: &str,
    open_index: usize,
    open_byte: u8,
    close_byte: u8,
) -> Option<usize> {
    let mut depth = 0;

    for (index, byte) in source.as_bytes().iter().enumerate().skip(open_index) {
        if *byte == open_byte {
            depth += 1;
        } else if *byte == close_byte {
            depth -= 1;
            if depth == 0 {
                return Some(index);
            }
        }
    }

    None
}

fn is_identifier_character(character: char) -> bool {
    character == '_' || character == '$' || character.is_ascii_alphanumeric()
}

fn display_project_path(project_path: &Path, path: &Path) -> String {
    path.strip_prefix(project_path)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs::{self, File},
        sync::atomic::{AtomicUsize, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    static TEST_PROJECT_COUNTER: AtomicUsize = AtomicUsize::new(0);

    struct TestProject {
        path: PathBuf,
    }

    impl TestProject {
        fn new() -> Self {
            let unique_id = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system clock should be after Unix epoch")
                .as_nanos();
            let counter = TEST_PROJECT_COUNTER.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "orbit-editor-schema-test-{}-{counter}-{unique_id}",
                std::process::id()
            ));

            fs::create_dir_all(&path).expect("test project directory should be created");
            Self { path }
        }

        fn create_file(&self, path: &str) {
            let file_path = self.path.join(path);
            if let Some(parent) = file_path.parent() {
                fs::create_dir_all(parent).expect("test file parent should be created");
            }

            File::create(file_path).expect("test file should be created");
        }
    }

    impl Drop for TestProject {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    #[test]
    fn finds_root_content_config_before_src_content_config() {
        let project = TestProject::new();
        project.create_file("content.config.ts");
        project.create_file("src/content.config.ts");

        let path = find_content_config(&project.path).expect("config should be found");

        assert_eq!(path, project.path.join("content.config.ts"));
    }

    #[test]
    fn finds_src_content_config() {
        let project = TestProject::new();
        project.create_file("src/content.config.ts");

        let path = find_content_config(&project.path).expect("config should be found");

        assert_eq!(path, project.path.join("src/content.config.ts"));
    }

    #[test]
    fn parses_shorthand_collection_export() {
        let parsed = parse_content_config(
            r#"
            const blog = defineCollection({
              schema: z.object({ title: z.string() }),
            });
            export const collections = { blog };
            "#,
        );

        assert!(parsed.schemas_by_collection.contains_key("blog"));
    }

    #[test]
    fn parses_aliased_and_string_key_collection_exports() {
        let parsed = parse_content_config(
            r#"
            const blogCollection = defineCollection({
              schema: z.object({ title: z.string() }),
            });
            export const collections = { "blog": blogCollection };
            "#,
        );

        assert!(parsed.schemas_by_collection.contains_key("blog"));
    }

    #[test]
    fn parses_inline_define_collection_exports() {
        let parsed = parse_content_config(
            r#"
            export const collections = {
              blog: defineCollection({
                schema: z.object({ title: z.string() }),
              }),
            };
            "#,
        );

        assert!(parsed.schemas_by_collection.contains_key("blog"));
    }

    #[test]
    fn maps_basic_schema_field_types() {
        let parsed = parse_content_config(
            r#"
            const blog = defineCollection({
              schema: z.object({
                title: z.string(),
                website: z.url(),
                email: z.email(),
                author: reference("authors"),
                views: z.number(),
                rating: z.coerce.number(),
                draft: z.boolean(),
                published: z.coerce.boolean(),
                date: z.date(),
                updated: z.coerce.date(),
                tags: z.array(z.string()),
                categories: z.string().array(),
                cover: image(),
              }),
            });
            export const collections = { blog };
            "#,
        );

        let schema = parsed
            .schemas_by_collection
            .get("blog")
            .expect("schema should be parsed");
        let field = |name: &str| {
            schema
                .fields
                .iter()
                .find(|field| field.name == name)
                .expect("field should exist")
                .field_type
        };

        assert_eq!(field("title"), FieldType::String);
        assert_eq!(field("website"), FieldType::String);
        assert_eq!(field("email"), FieldType::String);
        assert_eq!(field("author"), FieldType::String);
        assert_eq!(field("views"), FieldType::Number);
        assert_eq!(field("rating"), FieldType::Number);
        assert_eq!(field("draft"), FieldType::Boolean);
        assert_eq!(field("published"), FieldType::Boolean);
        assert_eq!(field("date"), FieldType::Date);
        assert_eq!(field("updated"), FieldType::Date);
        assert_eq!(field("tags"), FieldType::Array);
        assert_eq!(field("categories"), FieldType::Array);
        assert_eq!(field("cover"), FieldType::Image);
    }

    #[test]
    fn detects_optional_default_and_nullish_fields_as_not_required() {
        let parsed = parse_content_config(
            r#"
            const blog = defineCollection({
              schema: z.object({
                title: z.string(),
                subtitle: z.string().optional(),
                status: z.string().default("draft"),
                summary: z.string().nullish(),
              }),
            });
            export const collections = { blog };
            "#,
        );

        let schema = parsed
            .schemas_by_collection
            .get("blog")
            .expect("schema should be parsed");
        let required = |name: &str| {
            schema
                .fields
                .iter()
                .find(|field| field.name == name)
                .expect("field should exist")
                .required
        };

        assert!(required("title"));
        assert!(!required("subtitle"));
        assert!(!required("status"));
        assert!(!required("summary"));
    }

    #[test]
    fn marks_unsupported_fields_as_unknown() {
        let parsed = parse_content_config(
            r#"
            const blog = defineCollection({
              schema: z.object({
                status: z.enum(["draft", "published"]),
              }),
            });
            export const collections = { blog };
            "#,
        );

        let schema = parsed
            .schemas_by_collection
            .get("blog")
            .expect("schema should be parsed");

        assert_eq!(schema.fields[0].field_type, FieldType::Unknown);
        assert!(schema.warnings[0].contains("blog.status"));
    }

    #[test]
    fn ignores_comments_and_strings_when_matching_braces() {
        let parsed = parse_content_config(
            r#"
            const blog = defineCollection({
              // schema: z.object({ ignored: z.string() })
              schema: z.object({
                title: z.string().describe("text with } and , inside"),
              }),
            });
            export const collections = { blog };
            "#,
        );

        let schema = parsed
            .schemas_by_collection
            .get("blog")
            .expect("schema should be parsed");

        assert_eq!(schema.fields.len(), 1);
        assert_eq!(schema.fields[0].name, "title");
    }

    #[test]
    fn malformed_config_returns_warning_instead_of_failing() {
        let parsed = parse_content_config("export const collections =");

        assert!(parsed.schemas_by_collection.is_empty());
        assert!(!parsed.warnings.is_empty());
    }
}
