from html2image import Html2Image
hti = Html2Image()

html = """
<div style="background-color: #f8f9fa; padding: 20px; font-family: Arial, sans-serif; border: 1px solid #dee2e6; border-radius: 8px;">
    <h1 style="color: #0d6efd;">NeurOPS Rendering Test</h1>
    <p>If you see this, the rendering engine is working.</p>
</div>
"""

try:
    hti.screenshot(html_str=html, save_as='test_render.png')
    print("Success: test_render.png created.")
except Exception as e:
    print(f"Error rendering: {e}")
