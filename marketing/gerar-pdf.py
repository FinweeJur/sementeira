"""Gera o PDF da apresentação Sementeira via Playwright (Python).
Respeita position:absolute e backgrounds sem reescrita de CSS.
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

HTML = Path(__file__).parent / "slides.html"
PDF = Path(__file__).parent / "apresentacao-sementeira.pdf"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto(HTML.as_uri(), wait_until="networkidle")
    # Garante que as fontes web carregaram
    page.wait_for_timeout(2000)
    page.pdf(
        path=str(PDF),
        width="1280px",
        height="720px",
        margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
        print_background=True,
        prefer_css_page_size=False,
    )
    browser.close()

# Metadados
import pypdf
reader = pypdf.PdfReader(str(PDF))
writer = pypdf.PdfWriter()
for pg in reader.pages:
    writer.add_page(pg)
writer.add_metadata({
    "/Title": "Sementeira — Apresentação",
    "/Author": "Sementeira",
    "/Subject": "App desktop para projetos de reparação do Anexo I.1",
    "/Creator": "Sementeira",
})
with open(PDF, "wb") as f:
    writer.write(f)

print(f"OK: {PDF} ({len(reader.pages)} páginas)")
