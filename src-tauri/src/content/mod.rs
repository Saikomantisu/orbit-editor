use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
};

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
    pub file_path: String,
    pub extension: EntryExtension,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryExtension {
    Md,
    Mdx,
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
            file_path: path_to_string(&canonical_path),
            extension,
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

pub fn read_collection(collection: &str) -> Result<(), String> {
    if collection.trim().is_empty() {
        return Err("Choose a collection before reading entries.".to_string());
    }

    Err("Collection reading is not implemented yet.".to_string())
}

pub fn read_entry(file_path: &str) -> Result<(), String> {
    if file_path.trim().is_empty() {
        return Err("Choose an entry before reading it.".to_string());
    }

    Err("Entry reading is not implemented yet.".to_string())
}

pub fn delete_entry(file_path: &str) -> Result<(), String> {
    if file_path.trim().is_empty() {
        return Err("Choose an entry before deleting it.".to_string());
    }

    Err("Entry deletion is not implemented yet.".to_string())
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

    fn path_as_str(path: &Path) -> &str {
        path.to_str().expect("test path should be valid Unicode")
    }
}
