import os
import sys
import subprocess
import markdown

def convert_md_to_pdf(md_path: str, pdf_path: str):
    html_path = md_path.replace(".md", ".html")
    with open(md_path, "r", encoding="utf-8") as f:
        md_content = f.read()

    html_body = markdown.markdown(md_content, extensions=["tables", "fenced_code", "sane_lists"])
    html_template = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>BeatAhead Implementation Document</title>
<style>
  @page {{ size: A4; margin: 18mm 16mm 20mm 16mm; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; line-height: 1.55; font-size: 10.5pt; margin: 0; }}
  h1 {{ font-size: 18pt; color: #0f172a; border-bottom: 2px solid #2563eb; padding-bottom: 6px; page-break-after: avoid; }}
  h2 {{ font-size: 13pt; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 22px; page-break-after: avoid; }}
  h3 {{ font-size: 11pt; color: #1d4ed8; margin-top: 16px; page-break-after: avoid; }}
  table {{ width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 8.5pt; page-break-inside: avoid; }}
  th, td {{ border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }}
  th {{ background-color: #0f2b48; color: #ffffff; }}
  tr:nth-child(even) {{ background-color: #f8fafc; }}
  code {{ font-family: Consolas, monospace; font-size: 9pt; background-color: #f1f5f9; padding: 2px 4px; }}
  pre {{ background-color: #0f172a; color: #e2e8f0; padding: 10px; border-radius: 6px; font-size: 8pt; line-height: 1.35; page-break-inside: avoid; }}
  blockquote {{ margin: 10px 0; padding: 8px 14px; background-color: #eff6ff; border-left: 4px solid #3b82f6; color: #1e40af; }}
  hr {{ border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }}
</style>
</head>
<body>
{html_body}
</body>
</html>"""

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_template)

    edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    if not os.path.exists(edge_path):
        edge_path = r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"

    abs_html = os.path.abspath(html_path)
    abs_pdf = os.path.abspath(pdf_path)

    subprocess.run([edge_path, "--headless", "--disable-gpu", "--run-all-compositor-stages-before-draw", f"--print-to-pdf={abs_pdf}", abs_html], check=True)
    print(f"Generated PDF: {abs_pdf} (size: {os.path.getsize(abs_pdf)} bytes)")

if __name__ == "__main__":
    md_file = sys.argv[1] if len(sys.argv) > 1 else r"c:\ML Model - Ischemic\reports\vitaldb_plan.md"
    pdf_file = sys.argv[2] if len(sys.argv) > 2 else md_file.replace(".md", ".pdf")
    convert_md_to_pdf(md_file, pdf_file)

