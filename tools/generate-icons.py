from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "icons"
ICON_DIR.mkdir(parents=True, exist_ok=True)


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def draw_icon(size: int) -> Image.Image:
    scale = 4
    canvas_size = size * scale
    image = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    padding = max(1, round(canvas_size * 0.04))
    radius = round(canvas_size * 0.23)
    draw.rounded_rectangle(
        (padding, padding, canvas_size - padding, canvas_size - padding),
        radius=radius,
        fill="#D92D20",
    )
    draw.rounded_rectangle(
        (
            round(canvas_size * 0.10),
            round(canvas_size * 0.10),
            round(canvas_size * 0.90),
            round(canvas_size * 0.90),
        ),
        radius=round(canvas_size * 0.17),
        outline="#FFB4AA",
        width=max(1, round(canvas_size * 0.025)),
    )

    font = load_font(round(canvas_size * 0.31))
    text = "MCN"
    bbox = draw.textbbox((0, 0), text, font=font, stroke_width=0)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    position = (
        (canvas_size - width) / 2,
        (canvas_size - height) / 2 - bbox[1] - canvas_size * 0.01,
    )
    draw.text(position, text, font=font, fill="#FFFFFF")
    return image.resize((size, size), Image.Resampling.LANCZOS)


for icon_size in (16, 32, 48, 128):
    draw_icon(icon_size).save(ICON_DIR / f"icon-{icon_size}.png")
