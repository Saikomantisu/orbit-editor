use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::{
    fs,
    path::{Component, Path, PathBuf},
    time::SystemTime,
};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

const MISSING_CONTENT_WARNING: &str =
    "src/content/ was not found, so there are no content collections to edit yet.";
const DIRECT_MARKDOWN_WARNING: &str =
    "Markdown files directly inside src/content/ are not assigned to a collection. Move them into a collection folder.";
const COLLECTION_READ_WARNING: &str =
    "Could not read every file in this collection. Check folder permissions.";
const OUTSIDE_PROJECT_WARNING: &str =
    "Skipped a file outside the selected project. Check for symlinks or moved files.";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionScan {
    pub project_path: String,
    pub content_path: String,
    pub schema_config_path: Option<String>,
    pub collections: Vec<CollectionSummary>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionSummary {
    pub name: String,
    pub path: String,
    pub entries: Vec<EntrySummary>,
    pub schema: Option<crate::schema::CollectionSchema>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntrySummary {
    pub id: String,
    pub slug: String,
    pub title: Option<String>,
    pub file_path: String,
    pub extension: EntryExtension,
    pub last_modified: Option<String>,
    pub draft: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub id: String,
    pub slug: String,
    pub file_path: String,
    pub extension: EntryExtension,
    pub frontmatter: Value,
    pub body: String,
    pub last_modified: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryExtension {
    Md,
    Mdx,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEntryInput {
    pub project_path: String,
    pub collection: String,
    pub slug: String,
    pub extension: EntryExtension,
    pub title: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateEntryInput {
    pub project_path: String,
    pub source_file_path: String,
    pub new_slug: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteEntryInput {
    pub project_path: String,
    pub file_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveEntryInput {
    pub project_path: String,
    pub file_path: String,
    pub frontmatter: Value,
    pub body: String,
}

pub fn scan_collections(project_path: &str) -> Result<CollectionScan, String> {
    if project_path.trim().is_empty() {
        return Err("Choose an Astro project folder before scanning collections.".to_string());
    }

    let project_path = Path::new(project_path)
        .canonicalize()
        .map_err(|_| "The selected project folder does not exist or cannot be read.".to_string())?;

    if !project_path.is_dir() {
        return Err("Choose an Astro project folder, not a file.".to_string());
    }

    let content_path = project_path.join("src").join("content");
    let mut warnings = Vec::new();

    if !content_path.exists() {
        warnings.push(MISSING_CONTENT_WARNING.to_string());
        return Ok(CollectionScan {
            project_path: path_to_string(&project_path),
            content_path: path_to_string(&content_path),
            schema_config_path: None,
            collections: Vec::new(),
            warnings,
        });
    }

    if !content_path.is_dir() {
        return Err("src/content/ exists, but it is not a folder.".to_string());
    }

    let content_entries = fs::read_dir(&content_path).map_err(|_| {
        "Could not read src/content/. Check that the folder exists and Orbit Editor has permission to read it."
            .to_string()
    })?;

    let mut collections = Vec::new();
    let mut has_direct_markdown_entries = false;

    for content_entry in content_entries {
        let Ok(content_entry) = content_entry else {
            continue;
        };

        let path = content_entry.path();
        let file_name = content_entry.file_name();
        let Some(file_name) = file_name.to_str() else {
            continue;
        };

        if file_name.starts_with('.') {
            continue;
        }

        let Ok(file_type) = content_entry.file_type() else {
            continue;
        };

        if file_type.is_symlink() {
            continue;
        }

        if file_type.is_dir() {
            collections.push(scan_collection_directory(&project_path, &path, file_name));
        } else if file_type.is_file() && markdown_extension(&path).is_some() {
            has_direct_markdown_entries = true;
        }
    }

    if has_direct_markdown_entries {
        warnings.push(DIRECT_MARKDOWN_WARNING.to_string());
    }

    collections.sort_by(|left, right| {
        left.name
            .to_lowercase()
            .cmp(&right.name.to_lowercase())
            .then_with(|| left.name.cmp(&right.name))
    });

    let schema_detection = crate::schema::detect_collection_schemas(&project_path, &collections);
    warnings.extend(schema_detection.warnings);

    for collection in &mut collections {
        collection.schema = schema_detection
            .schemas_by_collection
            .get(&collection.name)
            .cloned();

        if let Some(schema) = &collection.schema {
            collection.warnings.extend(schema.warnings.clone());
        }
    }

    Ok(CollectionScan {
        project_path: path_to_string(&project_path),
        content_path: path_to_string(&content_path),
        schema_config_path: schema_detection
            .config_path
            .as_ref()
            .map(|path| path_to_string(path)),
        collections,
        warnings,
    })
}

fn scan_collection_directory(
    project_path: &Path,
    collection_path: &Path,
    collection_name: &str,
) -> CollectionSummary {
    let mut collection = CollectionSummary {
        name: collection_name.to_string(),
        path: collection_path
            .canonicalize()
            .map(|path| path_to_string(&path))
            .unwrap_or_else(|_| path_to_string(collection_path)),
        entries: Vec::new(),
        schema: None,
        warnings: Vec::new(),
    };

    collect_entries(
        project_path,
        collection_path,
        collection_path,
        &mut collection.entries,
        &mut collection.warnings,
    );

    collection.entries.sort_by(|left, right| {
        left.slug
            .to_lowercase()
            .cmp(&right.slug.to_lowercase())
            .then_with(|| left.slug.cmp(&right.slug))
    });

    collection
}

fn collect_entries(
    project_path: &Path,
    collection_root: &Path,
    current_path: &Path,
    entries: &mut Vec<EntrySummary>,
    warnings: &mut Vec<String>,
) {
    let directory_entries = match fs::read_dir(current_path) {
        Ok(directory_entries) => directory_entries,
        Err(_) => {
            push_unique_warning(warnings, COLLECTION_READ_WARNING);
            return;
        }
    };

    for directory_entry in directory_entries {
        let Ok(directory_entry) = directory_entry else {
            push_unique_warning(warnings, COLLECTION_READ_WARNING);
            continue;
        };

        let path = directory_entry.path();
        let Ok(file_type) = directory_entry.file_type() else {
            push_unique_warning(warnings, COLLECTION_READ_WARNING);
            continue;
        };

        if file_type.is_symlink() {
            continue;
        }

        if file_type.is_dir() {
            collect_entries(project_path, collection_root, &path, entries, warnings);
            continue;
        }

        if !file_type.is_file() {
            continue;
        }

        let Some(extension) = markdown_extension(&path) else {
            continue;
        };

        let canonical_path = match path.canonicalize() {
            Ok(canonical_path) => canonical_path,
            Err(_) => {
                push_unique_warning(warnings, COLLECTION_READ_WARNING);
                continue;
            }
        };

        if !canonical_path.starts_with(project_path) {
            push_unique_warning(warnings, OUTSIDE_PROJECT_WARNING);
            continue;
        }

        let Some(slug) = entry_slug(collection_root, &canonical_path) else {
            push_unique_warning(warnings, COLLECTION_READ_WARNING);
            continue;
        };

        entries.push(EntrySummary {
            id: slug.clone(),
            slug,
            title: entry_title(&canonical_path),
            file_path: path_to_string(&canonical_path),
            extension,
            last_modified: entry_last_modified(&canonical_path),
            draft: entry_draft(&canonical_path),
        });
    }
}

fn markdown_extension(path: &Path) -> Option<EntryExtension> {
    match path.extension().and_then(|extension| extension.to_str()) {
        Some(extension) if extension.eq_ignore_ascii_case("md") => Some(EntryExtension::Md),
        Some(extension) if extension.eq_ignore_ascii_case("mdx") => Some(EntryExtension::Mdx),
        _ => None,
    }
}

fn entry_slug(collection_root: &Path, file_path: &Path) -> Option<String> {
    let relative_path = file_path.strip_prefix(collection_root).ok()?;
    let mut extensionless_path = PathBuf::from(relative_path);
    extensionless_path.set_extension("");

    let slug_parts = extensionless_path
        .components()
        .filter_map(|component| component.as_os_str().to_str())
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();

    if slug_parts.is_empty() {
        None
    } else {
        Some(slug_parts.join("/"))
    }
}

fn push_unique_warning(warnings: &mut Vec<String>, warning: &str) {
    if !warnings
        .iter()
        .any(|existing_warning| existing_warning == warning)
    {
        warnings.push(warning.to_string());
    }
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

fn display_project_path(project_path: &Path, path: &Path) -> String {
    path.strip_prefix(project_path)
        .unwrap_or(path)
        .to_string_lossy()
        .to_string()
}

fn entry_summary(collection_root: &Path, file_path: &Path) -> Result<EntrySummary, String> {
    let canonical_path = file_path
        .canonicalize()
        .map_err(|_| "Could not read the entry file. Check that it still exists.".to_string())?;
    let Some(extension) = markdown_extension(&canonical_path) else {
        return Err("Choose a Markdown or MDX entry.".to_string());
    };
    let Some(slug) = entry_slug(collection_root, &canonical_path) else {
        return Err("Could not determine the entry slug from its path.".to_string());
    };

    Ok(EntrySummary {
        id: slug.clone(),
        slug,
        title: entry_title(&canonical_path),
        file_path: path_to_string(&canonical_path),
        extension,
        last_modified: entry_last_modified(&canonical_path),
        draft: entry_draft(&canonical_path),
    })
}

fn entry_title(file_path: &Path) -> Option<String> {
    let contents = fs::read_to_string(file_path).ok()?;
    let frontmatter = extract_frontmatter(&contents)?;

    frontmatter
        .lines()
        .filter_map(parse_frontmatter_scalar)
        .find_map(|(name, value)| {
            if name == "title" {
                clean_scalar_string(value)
            } else {
                None
            }
        })
}

fn entry_draft(file_path: &Path) -> Option<bool> {
    let contents = fs::read_to_string(file_path).ok()?;
    let frontmatter = extract_frontmatter(&contents)?;

    frontmatter
        .lines()
        .filter_map(parse_frontmatter_scalar)
        .find_map(|(name, value)| {
            if name != "draft" {
                return None;
            }

            match value.trim() {
                value if value.eq_ignore_ascii_case("true") => Some(true),
                value if value.eq_ignore_ascii_case("false") => Some(false),
                _ => None,
            }
        })
}

fn entry_last_modified(file_path: &Path) -> Option<String> {
    let modified = fs::metadata(file_path).ok()?.modified().ok()?;
    system_time_to_rfc3339(modified)
}

fn system_time_to_rfc3339(value: SystemTime) -> Option<String> {
    let datetime = OffsetDateTime::from(value);
    datetime.format(&Rfc3339).ok()
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

fn parse_frontmatter_scalar(line: &str) -> Option<(&str, &str)> {
    if line.trim().is_empty() || line.trim_start().starts_with('#') || is_indented(line) {
        return None;
    }

    let (name, value) = line.split_once(':')?;
    let name = name.trim();
    if name.is_empty() {
        return None;
    }

    Some((name, value.trim()))
}

fn is_indented(line: &str) -> bool {
    line.starts_with(' ') || line.starts_with('\t')
}

fn clean_scalar_string(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty() || value.starts_with('[') || value.starts_with('{') {
        return None;
    }

    let unquoted = if value.len() >= 2 {
        let first = value.as_bytes()[0];
        let last = value.as_bytes()[value.len() - 1];
        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            &value[1..value.len() - 1]
        } else {
            value
        }
    } else {
        value
    };

    let cleaned = unquoted.trim();
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned.to_string())
    }
}

fn canonical_project_path(project_path: &str) -> Result<PathBuf, String> {
    if project_path.trim().is_empty() {
        return Err("Choose an Astro project folder before managing entries.".to_string());
    }

    let project_path = Path::new(project_path)
        .canonicalize()
        .map_err(|_| "The selected project folder does not exist or cannot be read.".to_string())?;

    if !project_path.is_dir() {
        return Err("Choose an Astro project folder, not a file.".to_string());
    }

    Ok(project_path)
}

fn content_path(project_path: &Path) -> PathBuf {
    project_path.join("src").join("content")
}

fn validate_collection_path(project_path: &Path, collection: &str) -> Result<PathBuf, String> {
    if collection.trim().is_empty()
        || collection.contains('/')
        || collection.contains('\\')
        || collection == "."
        || collection == ".."
    {
        return Err("Choose a valid collection before creating an entry.".to_string());
    }

    let collection_path = content_path(project_path).join(collection);
    let canonical_collection_path = collection_path
        .canonicalize()
        .map_err(|_| "The selected collection folder does not exist.".to_string())?;

    let canonical_content_path = content_path(project_path)
        .canonicalize()
        .map_err(|_| "src/content/ does not exist in the selected project.".to_string())?;

    if !canonical_collection_path.is_dir()
        || !canonical_collection_path.starts_with(&canonical_content_path)
    {
        return Err("Choose a collection inside src/content/.".to_string());
    }

    Ok(canonical_collection_path)
}

fn validate_slug(slug: &str) -> Result<PathBuf, String> {
    let slug = slug.trim();
    if slug.is_empty() {
        return Err("Enter a slug before creating an entry.".to_string());
    }
    if slug.contains('\\') {
        return Err("Use forward slashes in entry slugs, not backslashes.".to_string());
    }
    if slug.split('/').any(|segment| segment.is_empty()) {
        return Err("Entry slugs cannot contain '.', '..', or empty path segments.".to_string());
    }

    let path = Path::new(slug);
    if path.is_absolute() {
        return Err("Entry slugs must be relative to the collection.".to_string());
    }

    let mut normalized = PathBuf::new();
    for component in path.components() {
        let Component::Normal(segment) = component else {
            return Err(
                "Entry slugs cannot contain '.', '..', or empty path segments.".to_string(),
            );
        };

        let Some(segment) = segment.to_str() else {
            return Err("Entry slugs must use valid Unicode characters.".to_string());
        };

        if segment.is_empty()
            || segment == "."
            || segment == ".."
            || !segment.chars().all(|character| {
                character.is_ascii_alphanumeric() || matches!(character, '_' | '-' | '.')
            })
        {
            return Err("Entry slugs may only use letters, numbers, underscores, hyphens, dots, and forward slashes.".to_string());
        }

        normalized.push(segment);
    }

    if normalized.as_os_str().is_empty() {
        Err("Enter a slug before creating an entry.".to_string())
    } else {
        Ok(normalized)
    }
}

fn entry_path_for_slug(
    collection_path: &Path,
    slug: &str,
    extension: EntryExtension,
) -> Result<PathBuf, String> {
    let mut relative_path = validate_slug(slug)?;
    relative_path.set_extension(extension.as_str());
    let target_path = collection_path.join(relative_path);

    if !target_path.starts_with(collection_path) {
        return Err("Entry path must stay inside the selected collection.".to_string());
    }

    Ok(target_path)
}

fn source_collection_root(project_path: &Path, source_file_path: &Path) -> Result<PathBuf, String> {
    let source_path = source_file_path
        .canonicalize()
        .map_err(|_| "The source entry file does not exist.".to_string())?;
    let canonical_content_path = content_path(project_path)
        .canonicalize()
        .map_err(|_| "src/content/ does not exist in the selected project.".to_string())?;

    if !source_path.starts_with(&canonical_content_path) {
        return Err(
            "Choose an entry inside the selected project's src/content/ folder.".to_string(),
        );
    }

    let relative = source_path
        .strip_prefix(&canonical_content_path)
        .map_err(|_| "Could not read the source entry path.".to_string())?;
    let Some(collection_name) =
        relative
            .components()
            .next()
            .and_then(|component| match component {
                Component::Normal(name) => name.to_str(),
                _ => None,
            })
    else {
        return Err("Choose an entry inside a content collection.".to_string());
    };

    let collection_root = canonical_content_path.join(collection_name);
    if !collection_root.is_dir() {
        return Err("The source entry collection no longer exists.".to_string());
    }

    Ok(collection_root)
}

impl EntryExtension {
    fn as_str(self) -> &'static str {
        match self {
            EntryExtension::Md => "md",
            EntryExtension::Mdx => "mdx",
        }
    }
}

fn title_from_slug(slug: &str) -> String {
    let title = slug
        .split('/')
        .filter_map(|segment| segment.rsplit('.').next())
        .flat_map(|segment| segment.split('-'))
        .filter(|word| !word.is_empty())
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ");

    if title.is_empty() {
        "Untitled".to_string()
    } else {
        title
    }
}

fn escape_yaml_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

pub fn read_collection(collection: &str) -> Result<(), String> {
    if collection.trim().is_empty() {
        return Err("Choose a collection before reading entries.".to_string());
    }

    Err("Collection reading is not implemented yet.".to_string())
}

pub fn read_entry_file(project_path: &str, file_path: &str) -> Result<Entry, String> {
    let project_path = canonical_project_path(project_path)?;
    let (entry_path, collection_path, extension) =
        validate_entry_file_path(&project_path, file_path)?;
    let contents = fs::read_to_string(&entry_path)
        .map_err(|_| "Could not read the entry file. Check that it still exists.".to_string())?;
    let (frontmatter, body) = parse_entry_contents(&project_path, &entry_path, &contents)?;
    let slug = entry_slug(&collection_path, &entry_path)
        .ok_or_else(|| "Could not determine the entry slug from its path.".to_string())?;

    Ok(Entry {
        id: slug.clone(),
        slug,
        file_path: path_to_string(&entry_path),
        extension,
        frontmatter,
        body,
        last_modified: entry_last_modified(&entry_path),
    })
}

pub fn save_entry(input: SaveEntryInput) -> Result<Entry, String> {
    let project_path = canonical_project_path(&input.project_path)?;
    let (entry_path, _collection_path, _extension) =
        validate_entry_file_path(&project_path, &input.file_path)?;

    if !input.frontmatter.is_object() {
        return Err("Frontmatter must be a YAML object before saving.".to_string());
    }

    let yaml = serde_yaml::to_string(&input.frontmatter)
        .map_err(|_| "Could not serialize frontmatter to YAML.".to_string())?;
    let yaml = yaml.trim_end();
    let contents = format!("---\n{yaml}\n---\n{}", input.body);

    fs::write(&entry_path, contents)
        .map_err(|_| "Could not save entry. Check project permissions.".to_string())?;

    read_entry_file(&input.project_path, &input.file_path)
}

pub fn create_entry(input: CreateEntryInput) -> Result<EntrySummary, String> {
    let project_path = canonical_project_path(&input.project_path)?;
    let collection_path = validate_collection_path(&project_path, &input.collection)?;
    let target_path = entry_path_for_slug(&collection_path, &input.slug, input.extension)?;

    if target_path.exists() {
        return Err("Could not create entry. A file already exists for that slug.".to_string());
    }

    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|_| {
            "Could not create the entry folder. Check project permissions.".to_string()
        })?;
    }

    let title = clean_scalar_string(&input.title).unwrap_or_else(|| title_from_slug(&input.slug));
    let contents = format!(
        "---\ntitle: \"{}\"\ndraft: true\n---\n\n",
        escape_yaml_string(&title)
    );

    fs::write(&target_path, contents)
        .map_err(|_| "Could not create entry. Check project permissions.".to_string())?;

    entry_summary(&collection_path, &target_path)
}

pub fn duplicate_entry(input: DuplicateEntryInput) -> Result<EntrySummary, String> {
    let project_path = canonical_project_path(&input.project_path)?;
    let source_path = Path::new(&input.source_file_path)
        .canonicalize()
        .map_err(|_| "The source entry file does not exist.".to_string())?;
    let collection_path = source_collection_root(&project_path, &source_path)?;
    let Some(extension) = markdown_extension(&source_path) else {
        return Err("Choose a Markdown or MDX entry to duplicate.".to_string());
    };
    let target_path = entry_path_for_slug(&collection_path, &input.new_slug, extension)?;

    if target_path.exists() {
        return Err("Could not duplicate entry. Choose a different slug.".to_string());
    }

    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|_| {
            "Could not create the duplicate entry folder. Check project permissions.".to_string()
        })?;
    }

    fs::copy(&source_path, &target_path)
        .map_err(|_| "Could not duplicate entry. Check project permissions.".to_string())?;

    entry_summary(&collection_path, &target_path)
}

pub fn delete_entry(input: DeleteEntryInput) -> Result<(), String> {
    let project_path = canonical_project_path(&input.project_path)?;
    if input.file_path.trim().is_empty() {
        return Err("Choose an entry before deleting it.".to_string());
    }

    let target_path = Path::new(&input.file_path)
        .canonicalize()
        .map_err(|_| "Could not delete entry. The file no longer exists.".to_string())?;
    let canonical_content_path = content_path(&project_path)
        .canonicalize()
        .map_err(|_| "src/content/ does not exist in the selected project.".to_string())?;

    if !target_path.starts_with(&canonical_content_path) {
        return Err(
            "Could not delete entry. Choose a file inside the selected project.".to_string(),
        );
    }

    if !target_path.is_file() {
        return Err("Could not delete entry. The selected path is not a file.".to_string());
    }

    if markdown_extension(&target_path).is_none() {
        return Err(
            "Could not delete entry. Only Markdown and MDX entries can be deleted.".to_string(),
        );
    }

    fs::remove_file(&target_path)
        .map_err(|_| "Could not delete entry. Check project permissions.".to_string())
}

fn validate_entry_file_path(
    project_path: &Path,
    file_path: &str,
) -> Result<(PathBuf, PathBuf, EntryExtension), String> {
    if file_path.trim().is_empty() {
        return Err("Choose an entry before reading it.".to_string());
    }

    let entry_path = Path::new(file_path)
        .canonicalize()
        .map_err(|_| "Could not read the entry file. Check that it still exists.".to_string())?;
    let canonical_content_path = content_path(project_path)
        .canonicalize()
        .map_err(|_| "src/content/ does not exist in the selected project.".to_string())?;

    if !entry_path.starts_with(&canonical_content_path) {
        return Err(
            "Choose an entry inside the selected project's src/content/ folder.".to_string(),
        );
    }

    if !entry_path.is_file() {
        return Err("Choose a Markdown or MDX entry file.".to_string());
    }

    let Some(extension) = markdown_extension(&entry_path) else {
        return Err("Choose a Markdown or MDX entry.".to_string());
    };

    let collection_path = source_collection_root(project_path, &entry_path)?;

    Ok((entry_path, collection_path, extension))
}

fn parse_entry_contents(
    project_path: &Path,
    entry_path: &Path,
    contents: &str,
) -> Result<(Value, String), String> {
    let Some(after_opening_marker) = contents.strip_prefix("---") else {
        return Ok((Value::Object(Map::new()), contents.to_string()));
    };

    let Some(after_opening_newline) = after_opening_marker
        .strip_prefix("\r\n")
        .or_else(|| after_opening_marker.strip_prefix('\n'))
    else {
        return Ok((Value::Object(Map::new()), contents.to_string()));
    };

    let Some((frontmatter_source, body)) = split_frontmatter_body(after_opening_newline) else {
        return Err(format!(
            "Could not parse frontmatter in {}. Check that the YAML block is valid.",
            display_project_path(project_path, entry_path)
        ));
    };

    let parsed = serde_yaml::from_str::<Value>(frontmatter_source).map_err(|_| {
        format!(
            "Could not parse frontmatter in {}. Check that the YAML block is valid.",
            display_project_path(project_path, entry_path)
        )
    })?;

    let frontmatter = match parsed {
        Value::Null => Value::Object(Map::new()),
        value if value.is_object() => value,
        _ => {
            return Err(format!(
                "Could not parse frontmatter in {}. The YAML block must be an object.",
                display_project_path(project_path, entry_path)
            ));
        }
    };

    Ok((frontmatter, body.to_string()))
}

fn split_frontmatter_body(contents_after_opening: &str) -> Option<(&str, &str)> {
    if let Some(body) = contents_after_opening.strip_prefix("---\r\n") {
        return Some(("", body));
    }

    if let Some(body) = contents_after_opening.strip_prefix("---\n") {
        return Some(("", body));
    }

    if contents_after_opening == "---" {
        return Some(("", ""));
    }

    for marker in ["\n---\r\n", "\n---\n", "\r\n---\r\n", "\r\n---\n"] {
        if let Some(index) = contents_after_opening.find(marker) {
            let marker_len = marker.len();
            return Some((
                &contents_after_opening[..index],
                &contents_after_opening[index + marker_len..],
            ));
        }
    }

    for marker in ["\n---", "\r\n---"] {
        if contents_after_opening.ends_with(marker) {
            let index = contents_after_opening.len() - marker.len();
            return Some((&contents_after_opening[..index], ""));
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        path::{Path, PathBuf},
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
                "orbit-editor-content-test-{}-{counter}-{unique_id}",
                std::process::id()
            ));

            fs::create_dir_all(&path).expect("test project directory should be created");
            Self { path }
        }

        fn create_dir(&self, path: &str) {
            fs::create_dir_all(self.path.join(path)).expect("test directory should be created");
        }

        fn create_file(&self, path: &str) {
            self.create_file_with_contents(path, "");
        }

        fn create_file_with_contents(&self, path: &str, contents: &str) {
            let file_path = self.path.join(path);
            if let Some(parent) = file_path.parent() {
                fs::create_dir_all(parent).expect("test file parent should be created");
            }

            fs::write(file_path, contents).expect("test file should be written");
        }

        fn scan(&self) -> CollectionScan {
            scan_collections(
                self.path
                    .to_str()
                    .expect("test project path should be valid Unicode"),
            )
            .expect("collection scan should succeed")
        }
    }

    impl Drop for TestProject {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    #[test]
    fn returns_empty_scan_when_content_directory_is_missing() {
        let project = TestProject::new();

        let scan = project.scan();

        assert!(scan.collections.is_empty());
        assert!(scan
            .warnings
            .iter()
            .any(|warning| warning.contains("src/content/")));
    }

    #[test]
    fn detects_first_level_collection_folders() {
        let project = TestProject::new();
        project.create_dir("src/content/projects");
        project.create_dir("src/content/blog");

        let scan = project.scan();

        let collection_names = scan
            .collections
            .iter()
            .map(|collection| collection.name.as_str())
            .collect::<Vec<_>>();
        assert_eq!(collection_names, vec!["blog", "projects"]);
    }

    #[test]
    fn includes_empty_collection_folders() {
        let project = TestProject::new();
        project.create_dir("src/content/blog");

        let scan = project.scan();

        assert_eq!(scan.collections.len(), 1);
        assert_eq!(scan.collections[0].name, "blog");
        assert!(scan.collections[0].entries.is_empty());
    }

    #[test]
    fn detects_md_and_mdx_entries_recursively() {
        let project = TestProject::new();
        project.create_file("src/content/blog/hello.md");
        project.create_file("src/content/blog/guides/start.mdx");

        let scan = project.scan();
        let entries = &scan.collections[0].entries;

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].slug, "guides/start");
        assert_eq!(entries[0].extension, EntryExtension::Mdx);
        assert_eq!(entries[1].slug, "hello");
        assert_eq!(entries[1].extension, EntryExtension::Md);
    }

    #[test]
    fn includes_underscore_prefixed_entries_and_folders() {
        let project = TestProject::new();
        project.create_file("src/content/blog/_draft.md");
        project.create_file("src/content/blog/_partials/intro.mdx");

        let scan = project.scan();
        let entry_slugs = scan.collections[0]
            .entries
            .iter()
            .map(|entry| entry.slug.as_str())
            .collect::<Vec<_>>();

        assert_eq!(entry_slugs, vec!["_draft", "_partials/intro"]);
    }

    #[test]
    fn ignores_non_markdown_files() {
        let project = TestProject::new();
        project.create_file("src/content/blog/notes.txt");
        project.create_file("src/content/blog/data.json");
        project.create_file("src/content/blog/image.png");
        project.create_file("src/content/blog/component.astro");
        project.create_file("src/content/blog/entry.md");

        let scan = project.scan();

        assert_eq!(scan.collections[0].entries.len(), 1);
        assert_eq!(scan.collections[0].entries[0].slug, "entry");
    }

    #[test]
    fn warns_about_markdown_files_directly_under_content() {
        let project = TestProject::new();
        project.create_dir("src/content");
        project.create_file("src/content/orphan.md");

        let scan = project.scan();

        assert!(scan.collections.is_empty());
        assert!(scan
            .warnings
            .iter()
            .any(|warning| warning.contains("directly inside src/content/")));
    }

    #[test]
    fn sorts_collections_and_entries_deterministically() {
        let project = TestProject::new();
        project.create_file("src/content/Zeta/beta.md");
        project.create_file("src/content/Zeta/Alpha.md");
        project.create_file("src/content/blog/z-last.md");
        project.create_file("src/content/blog/a-first.mdx");

        let scan = project.scan();

        let collection_names = scan
            .collections
            .iter()
            .map(|collection| collection.name.as_str())
            .collect::<Vec<_>>();
        assert_eq!(collection_names, vec!["blog", "Zeta"]);

        let blog_entries = scan.collections[0]
            .entries
            .iter()
            .map(|entry| entry.slug.as_str())
            .collect::<Vec<_>>();
        assert_eq!(blog_entries, vec!["a-first", "z-last"]);

        let zeta_entries = scan.collections[1]
            .entries
            .iter()
            .map(|entry| entry.slug.as_str())
            .collect::<Vec<_>>();
        assert_eq!(zeta_entries, vec!["Alpha", "beta"]);
    }

    #[test]
    fn attaches_config_schema_to_matching_collection() {
        let project = TestProject::new();
        project.create_file("src/content/blog/hello.md");
        project.create_file_with_contents(
            "content.config.ts",
            r#"
            const blog = defineCollection({
              schema: z.object({
                title: z.string(),
                draft: z.boolean().optional(),
              }),
            });

            export const collections = { blog };
            "#,
        );

        let scan = project.scan();
        let schema = scan.collections[0]
            .schema
            .as_ref()
            .expect("schema should be detected");

        assert_eq!(schema.source, crate::schema::SchemaSource::ContentConfig);
        assert_eq!(schema.fields.len(), 2);
        assert!(scan.schema_config_path.is_some());
    }

    #[test]
    fn falls_back_to_inferred_frontmatter_when_no_config_exists() {
        let project = TestProject::new();
        project.create_file_with_contents(
            "src/content/blog/hello.md",
            r#"---
title: Hello
draft: false
tags:
  - astro
date: 2026-07-10
---

Body
"#,
        );

        let scan = project.scan();
        let schema = scan.collections[0]
            .schema
            .as_ref()
            .expect("schema should be inferred");

        assert_eq!(
            schema.source,
            crate::schema::SchemaSource::FrontmatterInference
        );
        assert!(schema.fields.iter().any(|field| {
            field.name == "title" && field.field_type == crate::schema::FieldType::String
        }));
        assert!(schema.fields.iter().any(|field| {
            field.name == "draft" && field.field_type == crate::schema::FieldType::Boolean
        }));
        assert!(schema.fields.iter().any(|field| {
            field.name == "tags" && field.field_type == crate::schema::FieldType::Array
        }));
        assert!(schema.fields.iter().any(|field| {
            field.name == "date" && field.field_type == crate::schema::FieldType::Date
        }));
    }

    #[test]
    fn falls_back_to_frontmatter_when_config_schema_shape_is_unsupported() {
        let project = TestProject::new();
        project.create_file_with_contents(
            "src/content/blog/hello.md",
            r#"---
title: Hello
---

Body
"#,
        );
        project.create_file_with_contents(
            "content.config.ts",
            r#"
            const schema = z.object({ title: z.string() });
            const blog = defineCollection({ schema });
            export const collections = { blog };
            "#,
        );

        let scan = project.scan();
        let schema = scan.collections[0]
            .schema
            .as_ref()
            .expect("schema should be inferred");

        assert_eq!(
            schema.source,
            crate::schema::SchemaSource::FrontmatterInference
        );
        assert!(scan
            .warnings
            .iter()
            .any(|warning| warning.contains("blog schema")));
    }

    #[test]
    fn malformed_config_does_not_block_collection_detection() {
        let project = TestProject::new();
        project.create_file("src/content/blog/hello.md");
        project.create_file_with_contents("content.config.ts", "export const collections =");

        let scan = project.scan();

        assert_eq!(scan.collections.len(), 1);
        assert!(scan
            .warnings
            .iter()
            .any(|warning| warning.contains("collections object")));
    }

    #[test]
    fn rejects_empty_project_path() {
        let error = scan_collections("").expect_err("empty project path should fail");

        assert_eq!(
            error,
            "Choose an Astro project folder before scanning collections."
        );
    }

    #[test]
    fn rejects_project_path_that_is_a_file() {
        let project = TestProject::new();
        project.create_file("package.json");
        let file_path = project.path.join("package.json");

        let error = scan_collections(path_as_str(&file_path))
            .expect_err("file path should not be accepted as a project path");

        assert_eq!(error, "Choose an Astro project folder, not a file.");
    }

    #[test]
    fn scans_entry_title_draft_and_modified_time() {
        let project = TestProject::new();
        project.create_file_with_contents(
            "src/content/blog/hello.md",
            r#"---
title: "Hello World"
draft: true
---

Body
"#,
        );

        let scan = project.scan();
        let entry = &scan.collections[0].entries[0];

        assert_eq!(entry.title.as_deref(), Some("Hello World"));
        assert_eq!(entry.draft, Some(true));
        assert!(entry.last_modified.is_some());
    }

    #[test]
    fn scans_false_draft_status() {
        let project = TestProject::new();
        project.create_file_with_contents(
            "src/content/blog/hello.md",
            r#"---
draft: false
---

Body
"#,
        );

        let scan = project.scan();

        assert_eq!(scan.collections[0].entries[0].draft, Some(false));
    }

    #[test]
    fn entries_without_frontmatter_have_empty_metadata() {
        let project = TestProject::new();
        project.create_file_with_contents("src/content/blog/hello.md", "Body");

        let scan = project.scan();
        let entry = &scan.collections[0].entries[0];

        assert_eq!(entry.title, None);
        assert_eq!(entry.draft, None);
    }

    #[test]
    fn malformed_frontmatter_does_not_block_scan() {
        let project = TestProject::new();
        project.create_file_with_contents(
            "src/content/blog/hello.md",
            r#"---
title: Hello

Body
"#,
        );

        let scan = project.scan();

        assert_eq!(scan.collections[0].entries.len(), 1);
        assert_eq!(scan.collections[0].entries[0].title, None);
    }

    #[test]
    fn creates_entry_in_requested_collection() {
        let project = TestProject::new();
        project.create_dir("src/content/blog");

        let entry = create_entry(CreateEntryInput {
            project_path: path_as_str(&project.path).to_string(),
            collection: "blog".to_string(),
            slug: "new-post".to_string(),
            extension: EntryExtension::Md,
            title: "New Post".to_string(),
        })
        .expect("entry should be created");

        assert_eq!(entry.slug, "new-post");
        assert_eq!(entry.title.as_deref(), Some("New Post"));
        assert!(project.path.join("src/content/blog/new-post.md").exists());
    }

    #[test]
    fn create_entry_refuses_existing_target() {
        let project = TestProject::new();
        project.create_file("src/content/blog/new-post.md");

        let error = create_entry(CreateEntryInput {
            project_path: path_as_str(&project.path).to_string(),
            collection: "blog".to_string(),
            slug: "new-post".to_string(),
            extension: EntryExtension::Md,
            title: "New Post".to_string(),
        })
        .expect_err("existing entry should be refused");

        assert!(error.contains("already exists"));
    }

    #[test]
    fn create_entry_refuses_path_traversal() {
        let project = TestProject::new();
        project.create_dir("src/content/blog");

        let error = create_entry(CreateEntryInput {
            project_path: path_as_str(&project.path).to_string(),
            collection: "blog".to_string(),
            slug: "../outside".to_string(),
            extension: EntryExtension::Md,
            title: "Outside".to_string(),
        })
        .expect_err("path traversal should be refused");

        assert!(error.contains("cannot contain"));
    }

    #[test]
    fn duplicate_entry_copies_bytes_exactly() {
        let project = TestProject::new();
        let contents = "---\ntitle: Hello\n---\n\nBody";
        project.create_file_with_contents("src/content/blog/hello.mdx", contents);
        let source_file_path = project.path.join("src/content/blog/hello.mdx");

        let entry = duplicate_entry(DuplicateEntryInput {
            project_path: path_as_str(&project.path).to_string(),
            source_file_path: path_as_str(&source_file_path).to_string(),
            new_slug: "hello-copy".to_string(),
        })
        .expect("entry should be duplicated");

        let copied = fs::read_to_string(project.path.join("src/content/blog/hello-copy.mdx"))
            .expect("duplicate should be readable");
        assert_eq!(entry.slug, "hello-copy");
        assert_eq!(copied, contents);
    }

    #[test]
    fn duplicate_entry_refuses_overwrite() {
        let project = TestProject::new();
        project.create_file("src/content/blog/hello.md");
        project.create_file("src/content/blog/hello-copy.md");
        let source_file_path = project.path.join("src/content/blog/hello.md");

        let error = duplicate_entry(DuplicateEntryInput {
            project_path: path_as_str(&project.path).to_string(),
            source_file_path: path_as_str(&source_file_path).to_string(),
            new_slug: "hello-copy".to_string(),
        })
        .expect_err("duplicate overwrite should be refused");

        assert!(error.contains("different slug"));
    }

    #[test]
    fn delete_entry_removes_markdown_file() {
        let project = TestProject::new();
        project.create_file("src/content/blog/hello.md");
        let file_path = project.path.join("src/content/blog/hello.md");

        delete_entry(DeleteEntryInput {
            project_path: path_as_str(&project.path).to_string(),
            file_path: path_as_str(&file_path).to_string(),
        })
        .expect("entry should be deleted");

        assert!(!file_path.exists());
    }

    #[test]
    fn delete_entry_refuses_file_outside_content() {
        let project = TestProject::new();
        project.create_dir("src/content/blog");
        project.create_file("README.md");
        let file_path = project.path.join("README.md");

        let error = delete_entry(DeleteEntryInput {
            project_path: path_as_str(&project.path).to_string(),
            file_path: path_as_str(&file_path).to_string(),
        })
        .expect_err("outside file should be refused");

        assert!(error.contains("inside the selected project"));
    }

    #[test]
    fn delete_entry_refuses_non_markdown_file() {
        let project = TestProject::new();
        project.create_file("src/content/blog/data.json");
        let file_path = project.path.join("src/content/blog/data.json");

        let error = delete_entry(DeleteEntryInput {
            project_path: path_as_str(&project.path).to_string(),
            file_path: path_as_str(&file_path).to_string(),
        })
        .expect_err("non-markdown file should be refused");

        assert!(error.contains("Markdown and MDX"));
    }

    #[test]
    fn reads_md_entry_frontmatter_and_body() {
        let project = TestProject::new();
        project.create_file_with_contents(
            "src/content/blog/hello.md",
            "---\ntitle: Hello\ndraft: false\ntags:\n  - astro\n---\n\nBody\n",
        );
        let file_path = project.path.join("src/content/blog/hello.md");

        let entry = read_entry_file(path_as_str(&project.path), path_as_str(&file_path))
            .expect("entry should be read");

        assert_eq!(entry.slug, "hello");
        assert_eq!(entry.extension, EntryExtension::Md);
        assert_eq!(entry.frontmatter["title"], "Hello");
        assert_eq!(entry.frontmatter["draft"], false);
        assert_eq!(entry.body, "\nBody\n");
    }

    #[test]
    fn reads_mdx_entry_frontmatter_and_body() {
        let project = TestProject::new();
        project.create_file_with_contents(
            "src/content/blog/hello.mdx",
            "---\ntitle: Hello MDX\n---\n\n<Demo />\n",
        );
        let file_path = project.path.join("src/content/blog/hello.mdx");

        let entry = read_entry_file(path_as_str(&project.path), path_as_str(&file_path))
            .expect("entry should be read");

        assert_eq!(entry.extension, EntryExtension::Mdx);
        assert_eq!(entry.frontmatter["title"], "Hello MDX");
        assert_eq!(entry.body, "\n<Demo />\n");
    }

    #[test]
    fn reads_entry_without_frontmatter_as_empty_object() {
        let project = TestProject::new();
        project.create_file_with_contents("src/content/blog/hello.md", "Body only");
        let file_path = project.path.join("src/content/blog/hello.md");

        let entry = read_entry_file(path_as_str(&project.path), path_as_str(&file_path))
            .expect("entry should be read");

        assert_eq!(entry.frontmatter, serde_json::json!({}));
        assert_eq!(entry.body, "Body only");
    }

    #[test]
    fn reads_empty_frontmatter_as_empty_object() {
        let project = TestProject::new();
        project.create_file_with_contents("src/content/blog/hello.md", "---\n---\nBody");
        let file_path = project.path.join("src/content/blog/hello.md");

        let entry = read_entry_file(path_as_str(&project.path), path_as_str(&file_path))
            .expect("entry should be read");

        assert_eq!(entry.frontmatter, serde_json::json!({}));
        assert_eq!(entry.body, "Body");
    }

    #[test]
    fn read_entry_rejects_malformed_frontmatter() {
        let project = TestProject::new();
        project.create_file_with_contents("src/content/blog/hello.md", "---\ntitle: [\n---\nBody");
        let file_path = project.path.join("src/content/blog/hello.md");

        let error = read_entry_file(path_as_str(&project.path), path_as_str(&file_path))
            .expect_err("malformed YAML should fail");

        assert!(error.contains("Could not parse frontmatter"));
    }

    #[test]
    fn read_entry_rejects_non_object_frontmatter() {
        let project = TestProject::new();
        project.create_file_with_contents("src/content/blog/hello.md", "---\n- title\n---\nBody");
        let file_path = project.path.join("src/content/blog/hello.md");

        let error = read_entry_file(path_as_str(&project.path), path_as_str(&file_path))
            .expect_err("non-object YAML should fail");

        assert!(error.contains("must be an object"));
    }

    #[test]
    fn read_entry_rejects_missing_non_markdown_and_outside_files() {
        let project = TestProject::new();
        project.create_file("src/content/blog/data.json");
        project.create_file("README.md");

        let missing = project.path.join("src/content/blog/missing.md");
        let data = project.path.join("src/content/blog/data.json");
        let outside = project.path.join("README.md");

        assert!(read_entry_file(path_as_str(&project.path), "").is_err());
        assert!(read_entry_file(path_as_str(&project.path), path_as_str(&missing)).is_err());
        assert!(
            read_entry_file(path_as_str(&project.path), path_as_str(&data))
                .expect_err("non-markdown should fail")
                .contains("Markdown or MDX")
        );
        assert!(
            read_entry_file(path_as_str(&project.path), path_as_str(&outside))
                .expect_err("outside file should fail")
                .contains("src/content")
        );
    }

    #[test]
    fn save_entry_serializes_frontmatter_and_preserves_body() {
        let project = TestProject::new();
        project
            .create_file_with_contents("src/content/blog/hello.md", "---\ntitle: Old\n---\n\nBody");
        project.create_file_with_contents(
            "src/content/blog/other.md",
            "---\ntitle: Other\n---\n\nOther",
        );
        let file_path = project.path.join("src/content/blog/hello.md");

        let saved = save_entry(SaveEntryInput {
            project_path: path_as_str(&project.path).to_string(),
            file_path: path_as_str(&file_path).to_string(),
            frontmatter: serde_json::json!({
                "title": "New",
                "draft": false,
                "views": 42,
                "date": "2026-07-11",
                "tags": ["astro", "editor"]
            }),
            body: "\nBody".to_string(),
        })
        .expect("entry should save");

        let contents = fs::read_to_string(&file_path).expect("saved file should be readable");
        let other = fs::read_to_string(project.path.join("src/content/blog/other.md"))
            .expect("other file should be readable");

        assert_eq!(saved.frontmatter["title"], "New");
        assert!(contents.contains("title: New"));
        assert!(contents.contains("draft: false"));
        assert!(contents.ends_with("\nBody"));
        assert_eq!(other, "---\ntitle: Other\n---\n\nOther");
    }

    #[test]
    fn save_entry_preserves_mdx_body() {
        let project = TestProject::new();
        project.create_file_with_contents(
            "src/content/blog/hello.mdx",
            "---\ntitle: Old\n---\n\n<Demo />",
        );
        let file_path = project.path.join("src/content/blog/hello.mdx");

        save_entry(SaveEntryInput {
            project_path: path_as_str(&project.path).to_string(),
            file_path: path_as_str(&file_path).to_string(),
            frontmatter: serde_json::json!({ "title": "New" }),
            body: "\n<Demo />".to_string(),
        })
        .expect("entry should save");

        let contents = fs::read_to_string(file_path).expect("saved file should be readable");
        assert!(contents.ends_with("\n<Demo />"));
    }

    #[test]
    fn save_entry_rejects_invalid_targets_and_frontmatter() {
        let project = TestProject::new();
        project.create_file("src/content/blog/hello.md");
        project.create_file("README.md");
        let file_path = project.path.join("src/content/blog/hello.md");
        let outside = project.path.join("README.md");

        let error = save_entry(SaveEntryInput {
            project_path: path_as_str(&project.path).to_string(),
            file_path: path_as_str(&file_path).to_string(),
            frontmatter: serde_json::json!(["title"]),
            body: String::new(),
        })
        .expect_err("non-object frontmatter should fail");
        assert!(error.contains("must be a YAML object"));

        let error = save_entry(SaveEntryInput {
            project_path: path_as_str(&project.path).to_string(),
            file_path: path_as_str(&outside).to_string(),
            frontmatter: serde_json::json!({}),
            body: String::new(),
        })
        .expect_err("outside file should fail");
        assert!(error.contains("src/content"));
    }

    fn path_as_str(path: &Path) -> &str {
        path.to_str().expect("test path should be valid Unicode")
    }
}
