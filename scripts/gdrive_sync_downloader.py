#!/usr/bin/env python3
"""
Google Drive Auto-Downloader Script for Swahili Novels Pipeline
---------------------------------------------------------------
Scans Google Drive folder "sw爽文" (ID: 1oiVi-tZEvlo670Wt8tCPB9kjgAI6UTBh)
and automatically downloads any new novel folders or files to local target directory:
'/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文'
"""

import os
import io
import sys
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# Configuration
BASE_DIR = "/Users/yvoche/AI开发/000.非洲最终正文"
TARGET_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文"
TOKEN_FILE = os.path.join(BASE_DIR, "token.json")
FOLDER_ID = "1oiVi-tZEvlo670Wt8tCPB9kjgAI6UTBh" # "sw爽文" Folder ID
SCOPES = ['https://www.googleapis.com/auth/drive']

os.makedirs(TARGET_DIR, exist_ok=True)

def get_drive_service():
    if not os.path.exists(TOKEN_FILE):
        raise FileNotFoundError(f"OAuth token file not found at {TOKEN_FILE}")
    creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    return build('drive', 'v3', credentials=creds)

def download_file(service, file_id, dest_path):
    request = service.files().get_media(fileId=file_id)
    fh = io.FileIO(dest_path, 'wb')
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
    fh.close()

def download_folder_recursive(service, folder_id, local_current_dir):
    os.makedirs(local_current_dir, exist_ok=True)
    query = f"'{folder_id}' in parents and trashed = false"
    results = service.files().list(q=query, fields="files(id, name, mimeType)").execute()
    items = results.get('files', [])

    for item in items:
        item_name = item['name']
        item_id = item['id']
        item_mime = item['mimeType']
        
        local_path = os.path.join(local_current_dir, item_name)

        if item_mime == 'application/vnd.google-apps.folder':
            print(f"📁 Processing folder: {item_name} -> {local_path}")
            download_folder_recursive(service, item_id, local_path)
        else:
            if not os.path.exists(local_path):
                print(f"⬇️ Downloading new file: {item_name} ...")
                download_file(service, item_id, local_path)
                print(f"  ✅ Saved to {local_path}")
            else:
                print(f"⏩ Skipped existing file: {item_name}")

def sync_new_novels():
    print("🚀 Connecting to Google Drive to check for new Swahili novels...")
    service = get_drive_service()
    
    # Query items under 'sw爽文'
    query = f"'{FOLDER_ID}' in parents and trashed = false"
    results = service.files().list(q=query, fields="files(id, name, mimeType)").execute()
    items = results.get('files', [])

    new_count = 0
    for item in items:
        item_name = item['name']
        item_id = item['id']
        item_mime = item['mimeType']

        local_target_path = os.path.join(TARGET_DIR, item_name)

        if item_mime == 'application/vnd.google-apps.folder':
            if not os.path.exists(local_target_path):
                print(f"\n✨ NEW NOVEL FOLDER DETECTED: [{item_name}]")
                download_folder_recursive(service, item_id, local_target_path)
                new_count += 1
            else:
                # Check for new inner files incrementally
                download_folder_recursive(service, item_id, local_target_path)
        else:
            # Single markdown/text story file
            if item_name.endswith(('.md', '.txt', '.json')) and not os.path.exists(local_target_path):
                print(f"\n✨ NEW STORY FILE DETECTED: [{item_name}]")
                download_file(service, item_id, local_target_path)
                print(f"  ✅ Saved to {local_target_path}")
                new_count += 1

    print(f"\n🎉 Sync completed! Successfully checked Google Drive. Downloaded {new_count} new novel packages.")

if __name__ == "__main__":
    sync_new_novels()
