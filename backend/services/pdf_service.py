import os
import json
import pymupdf

def extract_pdf_pages(pdf_path: str, output_dir: str):
    os.makedirs(output_dir, exist_ok=True)
    doc = pymupdf.open(pdf_path)
    page_count = len(doc)
    page_files = []
    
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=150)
        img_name = f'page_{i+1}.png'
        img_path = os.path.join(output_dir, img_name)
        pix.save(img_path)
        page_files.append({
            'page_number': i + 1,
            'image_url': f'/api/pages/{os.path.basename(output_dir)}/{img_name}',
            'width': pix.width,
            'height': pix.height
        })
    doc.close()
    return page_files
