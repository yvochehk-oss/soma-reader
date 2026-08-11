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

TOKEN_FILE = "/Users/yvoche/AI开发/000.非洲最终正文/token.json"
SCOPES = ['https://www.googleapis.com/auth/drive']
PARENT_FOLDER_ID = "1UDbHrJon_ncLGt9D3vS39XSTrU_zptLQ" # "英文经典" folder in GDrive
DEST_BASE = "/Users/yvoche/AI开发/000.非洲最终正文/0.2英文经典手机版"

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

def sync_mobile_files():
    service = get_drive_service()

    print("==================================================")
    print(" ⬇️ 从 Google Drive 仅下载 QA 文件与 mobile_ 开头手机排版文件")
    print("==================================================\n")

    query = f"'{PARENT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    page_token = None
    folders = []

    while True:
        res = service.files().list(q=query, fields="nextPageToken, files(id, name)", pageToken=page_token, pageSize=200).execute()
        folders.extend(res.get('files', []))
        page_token = res.get('nextPageToken')
        if not page_token:
            break

    folders.sort(key=lambda x: x['name'])
    total_folders = len(folders)
    print(f"找到 {total_folders} 个图书目录。开始检视并精确下载...\n")

    downloaded_count = 0

    for idx, folder in enumerate(folders, 1):
        book_name = folder['name']
        folder_id = folder['id']

        target_dir_name = f"mobile_{book_name}"
        target_dir_path = os.path.join(DEST_BASE, target_dir_name)
        os.makedirs(target_dir_path, exist_ok=True)

        # List files in this book folder
        sub_query = f"'{folder_id}' in parents and trashed = false"
        sub_res = service.files().list(q=sub_query, fields="files(id, name, size, mimeType)").execute()
        sub_files = sub_res.get('files', [])

        # STRICT FILTER: Only files starting with 'mobile_' OR containing 'qa.json'
        mobile_files = [
            f for f in sub_files
            if f['name'].startswith('mobile_') or 'qa.json' in f['name'].lower()
        ]

        print(f"[{idx:2d}/{total_folders}] 📁 {book_name} (符合条件文件: {len(mobile_files)} 个)")

        for sf in mobile_files:
            sf_name = sf['name']
            sf_id = sf['id']
            sf_mime = sf.get('mimeType', '')

            local_filename = sf_name
            local_file_path = os.path.join(target_dir_path, local_filename)

            try:
                download_file(service, sf_id, local_file_path, sf_mime)
                sz_kb = os.path.getsize(local_file_path) / 1024
                print(f"  - ⬇️ {local_filename} ({sz_kb:.1f} KB)")
                downloaded_count += 1
            except Exception as e:
                print(f"  - ❌ 下载失败 {local_filename}: {e}")

    print(f"\n==================================================")
    print(f" 🎉 全部 {total_folders} 部名著的 QA 与 mobile_ 排版文件下载完成！共计下载 {downloaded_count} 个文件")
    print(f"==================================================")

if __name__ == "__main__":
    sync_mobile_files()
