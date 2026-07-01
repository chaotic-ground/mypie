// mypie desktop shell.
//
// Wraps the reused typie editor (built frontend) in a Tauri window and starts
// the ai-bridge (Claude Code proofreading server) alongside the app, so the
// user never has to launch it by hand. The bridge is bundled as a resource and
// run with the system `node`; it is killed when the app exits.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::path::BaseDirectory;
use tauri::{Manager, RunEvent};

// Holds the ai-bridge child process so we can stop it on exit.
struct Bridge(Mutex<Option<Child>>);

fn spawn_bridge(app: &tauri::App) -> Option<Child> {
    // The ai-bridge is dependency-free Node bundled under the app's resources.
    let entry = app
        .path()
        .resolve("ai-bridge/bin/mypie-ai-bridge.mjs", BaseDirectory::Resource)
        .ok()?;

    if !entry.exists() {
        // In `tauri dev` the resource isn't staged; the dev workflow runs the
        // bridge separately, so just skip rather than fail.
        eprintln!(
            "[mypie] ai-bridge resource not found at {} — assuming an external bridge",
            entry.display()
        );
        return None;
    }

    match Command::new("node").arg(&entry).arg("serve").spawn() {
        Ok(child) => {
            println!("[mypie] ai-bridge started (pid {})", child.id());
            Some(child)
        }
        Err(err) => {
            eprintln!("[mypie] failed to start ai-bridge (is `node` on PATH?): {err}");
            None
        }
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let child = spawn_bridge(app);
            app.manage(Bridge(Mutex::new(child)));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building mypie")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                if let Some(bridge) = app_handle.try_state::<Bridge>() {
                    if let Some(mut child) = bridge.0.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                }
            }
        });
}
