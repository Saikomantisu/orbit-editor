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
