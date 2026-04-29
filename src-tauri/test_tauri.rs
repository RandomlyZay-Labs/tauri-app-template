use tauri::Manager;
fn main() {
    let app = tauri::test::mock_app().handle().clone();
}
