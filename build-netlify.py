#!/usr/bin/env python
"""
Build a Netlify-ready deploy folder + zip.

  python build-netlify.py

Produces:
  netlify-deploy/          drag this folder onto https://app.netlify.com/drop
  netlify-deploy.zip       or drag this zip

Both are regenerable build artefacts and are gitignored.

Note on Windows: the zip is written with Python's zipfile using forward-slash arcnames.
PowerShell's Compress-Archive stores backslash separators, which Netlify does not
normalise — every file in a subfolder 404s. Do not swap this for Compress-Archive.
"""

import os, shutil, sys, zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(ROOT, "netlify-deploy")
ZIP  = os.path.join(ROOT, "netlify-deploy.zip")

# Everything the live site actually needs. Dev-only files (inspect.html, the hardware
# submission script, the reference mockup, the handoff scaffold) are deliberately excluded.
FILES = [
    "index.html",
    "lab.html",
    "studies.html",
    "js/physics.js",
    "js/chamber.js",
    "js/studies.js",
    "vendor/three.module.js",
    "vendor/GLTFLoader.js",
    "vendor/MeshSurfaceSampler.js",
    "vendor/BufferGeometryUtils.js",
    "vendor/postprocessing/EffectComposer.js",
    "vendor/postprocessing/RenderPass.js",
    "vendor/postprocessing/ShaderPass.js",
    "vendor/postprocessing/MaskPass.js",
    "vendor/postprocessing/Pass.js",
    "vendor/postprocessing/UnrealBloomPass.js",
    "vendor/postprocessing/OutputPass.js",
    "vendor/shaders/CopyShader.js",
    "vendor/shaders/LuminosityHighPassShader.js",
    "vendor/shaders/OutputShader.js",
    "models/schrodinger-cat.glb",
    "assets/quantum-cat.png",
    "assets/land/ion-trap.webp",
    "assets/land/cat-portrait.webp",
    "assets/land/sealed-box.webp",
    "assets/land/optics.webp",
]

# Included only if it exists — written by a real IBM Quantum job, never by anything else.
OPTIONAL = ["hardware/runs.json"]

NETLIFY_TOML = """# Schrödinger's Box — static site, no build step.
[build]
  publish = "."

# HTML and the hardware results must never be served stale.
[[headers]]
  for = "/*.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"

[[headers]]
  for = "/hardware/runs.json"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
    Content-Type = "application/json; charset=utf-8"

# Fingerprint-free but effectively immutable: the engine, the model and the imagery.
[[headers]]
  for = "/vendor/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/js/*"
  [headers.values]
    Cache-Control = "public, max-age=604800"

[[headers]]
  for = "/models/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
    Content-Type = "model/gltf-binary"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
"""


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)

    copied, missing, total = [], [], 0
    for rel in FILES:
        src = os.path.join(ROOT, rel.replace("/", os.sep))
        if not os.path.isfile(src):
            missing.append(rel)
            continue
        dst = os.path.join(OUT, rel.replace("/", os.sep))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        n = os.path.getsize(src)
        total += n
        copied.append((rel, n))

    for rel in OPTIONAL:
        src = os.path.join(ROOT, rel.replace("/", os.sep))
        if os.path.isfile(src):
            dst = os.path.join(OUT, rel.replace("/", os.sep))
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
            n = os.path.getsize(src)
            total += n
            copied.append((rel, n))
        else:
            print(f"note: {rel} not present — the study page will show its 'awaiting run' state")

    with open(os.path.join(OUT, "netlify.toml"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(NETLIFY_TOML)

    if missing:
        print("MISSING (deploy would be broken):", file=sys.stderr)
        for m in missing:
            print("  " + m, file=sys.stderr)
        return 1

    # Forward-slash arcnames. See the module docstring — this is the whole reason for the script.
    if os.path.exists(ZIP):
        os.remove(ZIP)
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for dirpath, _dirs, files in os.walk(OUT):
            for fn in files:
                full = os.path.join(dirpath, fn)
                arc = os.path.relpath(full, OUT).replace(os.sep, "/")
                z.write(full, arc)
        bad = [n for n in z.namelist() if "\\" in n]
        assert not bad, f"backslashes in zip entries: {bad[:3]}"

    print(f"\n{len(copied)} files -> netlify-deploy/  ({total/1024/1024:.2f} MB)")
    for rel, n in sorted(copied, key=lambda t: -t[1])[:6]:
        print(f"   {n/1024:8.1f} KB  {rel}")
    print(f"\nzip: netlify-deploy.zip ({os.path.getsize(ZIP)/1024/1024:.2f} MB, forward-slash paths verified)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
