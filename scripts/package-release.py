"""Verify the approved runtime, then package committed source and release assets."""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile

root = Path(__file__).resolve().parent.parent
version = json.loads((root / "package.json").read_text())["version"]
manifest = json.loads((root / f"docs/runtime-{version}-manifest.json").read_text())
assert manifest["version"] == version
runtime = root / "dist"
actual = {
    str(path.relative_to(runtime)): hashlib.sha256(path.read_bytes()).hexdigest()
    for path in sorted(runtime.rglob("*"))
    if path.is_file() and path.name != "BUILD_INFO.json"
}
assert actual == manifest["files"], "Build differs from the runtime-approved files. Review before release."
commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
(runtime / "BUILD_INFO.json").write_text(json.dumps({
    "version": version,
    "commit": commit,
    "status": "runtime-approved",
    "runtime_manifest": f"docs/runtime-{version}-manifest.json",
}, indent=2) + "\n")
output = root / "release-assets"
output.mkdir(exist_ok=True)
app_zip = output / f"Q-Podcasts_{version}_recovery-media.zip"
source_zip = output / f"Q-Podcasts_{version}_source.zip"
assert not list(output.iterdir()), "Use an empty release-assets directory."
with zipfile.ZipFile(app_zip, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(runtime.rglob("*")):
        if path.is_file():
            archive.write(path, path.relative_to(runtime))
subprocess.run(["git", "archive", "--format=zip", "--prefix=Q-Podcasts/", "-o", str(source_zip), "HEAD"], cwd=root, check=True)
for path in [app_zip, source_zip]:
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
with zipfile.ZipFile(app_zip) as archive:
    assert "index.html" in archive.namelist()
(output / "SHA256SUMS.txt").write_text("".join(
    f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n"
    for path in [app_zip, source_zip]
))
print(f"Verified {len(actual)} approved runtime files. Packaged {version} from {commit}.")
