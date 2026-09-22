#!/usr/bin/env python3
import os
import sys
import io
import time
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from googleapiclient.errors import HttpError

BASE_DIR = "/Users/yvoche/AI开发/000.非洲最终正文"
TARGET_DIR = "/Users/yvoche/AI开发/000.非洲最终正文/0.3 sw爽文"
TOKEN_FILE = os.path.join(BASE_DIR, "token.json")
FOLDER_ID = "1oiVi-tZEvlo670Wt8tCPB9kjgAI6UTBh"
SCOPES = ['https://www.googleapis.com/auth/drive']

os.makedirs(TARGET_DIR, exist_ok=True)

def get_drive_service():
    creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    return build('drive', 'v3', credentials=creds)

def download_file(service, file_id, dest_path, mime_type=None):
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    
    if mime_type and mime_type.startswith('application/vnd.google-apps'):
        request = service.files().export_media(fileId=file_id, mimeType='text/plain')
    else:
        request = service.files().get_media(fileId=file_id)
        
    with io.FileIO(dest_path, 'wb') as fh:
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            try:
                status, done = downloader.next_chunk()
            except HttpError as e:
                if 'fileNotDownloadable' in str(e) or 'Export' in str(e):
                    request = service.files().export_media(fileId=file_id, mimeType='text/plain')
                    downloader = MediaIoBaseDownload(fh, request)
                    status, done = downloader.next_chunk()
                else:
                    raise e

def sync_folder_recursive(service, folder_id, local_current_dir, parent_prefix=""):
    os.makedirs(local_current_dir, exist_ok=True)
    page_token = None
    items = []
    
    query = f"'{folder_id}' in parents and trashed = false"
    while True:
        res = service.files().list(q=query, fields="nextPageToken, files(id, name, size, mimeType)", pageToken=page_token, pageSize=200).execute()
        items.extend(res.get('files', []))
        page_token = res.get('nextPageToken')
        if not page_token:
            break
            
    items.sort(key=lambda x: (x['mimeType'] != 'application/vnd.google-apps.folder', x['name']))
    
    downloaded = 0
    skipped = 0
    
    for item in items:
        item_name = item['name']
        item_id = item['id']
        mime_type = item['mimeType']
        local_path = os.path.join(local_current_dir, item_name)
        display_name = f"{parent_prefix}/{item_name}" if parent_prefix else item_name
        
        if mime_type == 'application/vnd.google-apps.folder':
            d, s = sync_folder_recursive(service, item_id, local_path, display_name)
            downloaded += d
            skipped += s
        else:
            expected_size = int(item.get('size', 0))
            if os.path.exists(local_path):
                local_size = os.path.getsize(local_path)
                # If size matches or expected_size is 0 (Google Docs export), skip
                if expected_size > 0 and abs(local_size - expected_size) < 10:
                    skipped += 1
                    continue
                elif expected_size == 0 and local_size > 0:
                    skipped += 1
                    continue
                    
            try:
                download_file(service, item_id, local_path, mime_type)
                sz_kb = os.path.getsize(local_path) / 1024
                print(f"  - ⬇️ 下载/更新: [{display_name}] ({sz_kb:.1f} KB)")
                downloaded += 1
            except Exception as e:
                print(f"  - ❌ 下载失败 [{display_name}]: {e}")
                
    return downloaded, skipped

def sync_novels():
    print("==================================================")
    print(" ⬇️ 斯瓦希里语爽文 (sw爽文) Google Drive 增量同步下载")
    print("==================================================\n")
    print(f"云端目录 ID: {FOLDER_ID}")
    print(f"本地落盘路径: {TARGET_DIR}\n")
    
    service = get_drive_service()
    downloaded, skipped = sync_folder_recursive(service, FOLDER_ID, TARGET_DIR)
    
    print(f"\n==================================================")
    print(f" 🎉 爽文同步全量完成！")
    print(f"    - 新增/更新下载文件: {downloaded} 个")
    print(f"    - 校验一致并跳过: {skipped} 个")
    print(f"==================================================")

if __name__ == "__main__":
    sync_novels()
