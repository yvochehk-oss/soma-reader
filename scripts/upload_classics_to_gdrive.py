#!/usr/bin/env python3
import os
import sys
import json
import time
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SRC_BASE = "/Users/yvoche/AI开发/000.非洲最终正文/0.1英文经典"
PARENT_FOLDER_ID = "1UDbHrJon_ncLGt9D3vS39XSTrU_zptLQ" # "英文经典" folder in GDrive
TOKEN_FILE = "/Users/yvoche/AI开发/000.非洲最终正文/token.json"
SCOPES = ['https://www.googleapis.com/auth/drive']

def get_drive_service():
    creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    return build('drive', 'v3', credentials=creds)

def get_existing_items(service, parent_id):
    query = f"'{parent_id}' in parents and trashed = false"
    results = service.files().list(q=query, fields="files(id, name, mimeType)").execute()
    return {item['name']: item for item in results.get('files', [])}

def upload_folder_recursive(service, local_dir, gdrive_parent_id):
    existing = get_existing_items(service, gdrive_parent_id)
    items = sorted(os.listdir(local_dir))

    for item_name in items:
        if item_name.startswith('.'):
            continue

        local_path = os.path.join(local_dir, item_name)

        if os.path.isdir(local_path):
            # Create or get subfolder in Google Drive
            if item_name in existing and existing[item_name]['mimeType'] == 'application/vnd.google-apps.folder':
                subfolder_id = existing[item_name]['id']
            else:
                folder_meta = {
                    'name': item_name,
                    'mimeType': 'application/vnd.google-apps.folder',
                    'parents': [gdrive_parent_id]
                }
                created = service.files().create(body=folder_meta, fields='id').execute()
                subfolder_id = created['id']
                print(f" 📁 [GDrive] 创建子目录: {item_name}")

            upload_folder_recursive(service, local_path, subfolder_id)

        elif os.path.isfile(local_path):
            if item_name in existing:
                print(f"  - ⏩ 跳过已存在文件: {item_name}")
                continue

            ext = os.path.splitext(item_name)[1].lower()
            if ext == '.json':
                mimetype = 'application/json'
            elif ext in ('.txt', '.md'):
                mimetype = 'text/plain' if ext == '.txt' else 'text/markdown'
            else:
                mimetype = 'application/octet-stream'

            media = MediaFileUpload(local_path, mimetype=mimetype, resumable=True)
            file_meta = {
                'name': item_name,
                'parents': [gdrive_parent_id]
            }

            size_kb = os.path.getsize(local_path) / 1024
            print(f"  - ⬆️ 上传文件: {item_name} ({size_kb:.1f} KB)...", end="", flush=True)

            try:
                uploaded = service.files().create(body=file_meta, media_body=media, fields='id').execute()
                print(" ✅ 完成")
            except Exception as e:
                print(f" ❌ 上传错误: {e}")

def main():
    service = get_drive_service()
    dirs = [d for d in os.listdir(SRC_BASE) if os.path.isdir(os.path.join(SRC_BASE, d)) and not d.startswith('.')]
    dirs.sort()

    total = len(dirs)
    print(f"==================================================")
    print(f" 🚀 上传英文经典作品至 Google Drive '英文经典' 目录 (共 {total} 部作品)")
    print(f"==================================================\n")

    upload_folder_recursive(service, SRC_BASE, PARENT_FOLDER_ID)

    print(f"\n==================================================")
    print(f" 🎉 全部 {total} 部英文经典作品已成功同步上传至 Google Drive！")
    print(f" 📁 云端目录 ID: {PARENT_FOLDER_ID}")
    print(f"==================================================")

if __name__ == "__main__":
    main()
