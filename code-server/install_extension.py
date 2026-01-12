import sys
import json
import urllib.request
import urllib.error
import subprocess
import os

# Extension ID to install
EXTENSION_ID = "Anthropic.claude-code"
MARKETPLACE_API_URL = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery"

def get_latest_vsix_url(extension_id):
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json;api-version=6.0-preview.1"
    }
    
    data = {
        "filters": [
            {
                "criteria": [
                    {
                        "filterType": 7,
                        "value": extension_id
                    }
                ]
            }
        ],
        "flags": 103
    }
    
    try:
        req = urllib.request.Request(MARKETPLACE_API_URL, data=json.dumps(data).encode('utf-8'), headers=headers, method='POST')
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            
            results = result.get('results', [])
            if not results:
                raise Exception("No results found in Marketplace response")
                
            extensions = results[0].get('extensions', [])
            if not extensions:
                raise Exception(f"Extension '{extension_id}' not found in Marketplace")
                
            extension = extensions[0]
            versions = extension.get('versions', [])
            if not versions:
                raise Exception("No versions found for extension")
                
            latest = versions[0]
            files = latest.get('files', [])
            
            for f in files:
                if f.get('assetType') == "Microsoft.VisualStudio.Services.VSIXPackage":
                    return f.get('source')
            
            raise Exception("VSIX package asset not found in extension metadata")
            
    except Exception as e:
        print(f"Error resolving extension URL: {e}")
        sys.exit(1)

def install_extension():
    print(f"Resolving latest version of {EXTENSION_ID}...")
    try:
        vsix_url = get_latest_vsix_url(EXTENSION_ID)
        print(f"Found VSIX URL: {vsix_url}")
        
        vsix_path = os.path.join("/tmp", f"{EXTENSION_ID}.vsix")
        
        print(f"Downloading to {vsix_path}...")
        urllib.request.urlretrieve(vsix_url, vsix_path)
        
        print(f"Installing {EXTENSION_ID} to code-server...")
        subprocess.check_call(["code-server", "--install-extension", vsix_path])
        
        print("Installation successful.")
        os.remove(vsix_path)
        
    except Exception as e:
        print(f"Failed to install extension: {e}")
        sys.exit(1)

if __name__ == "__main__":
    install_extension()
