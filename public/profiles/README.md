# Alumetric Profile Catalog Images

This folder dynamically serves custom drawing assets for aluminum profile sections in your app.

## How It Works

The app automatically resolves custom image files based on the chosen profile code (`code`). For example, for the profile `70T-102-18`, it attempts to load `/profiles/70T-102-18.png`. If not found, it gracefully falls back to displaying the native vector CAD SVG drawing.

## Adding or Updating Drawings

1. Prepare your profile drawings in PNG format (preferably transparent or with a solid white background).
2. Save files using the exact case-sensitive profile code name:
   - For `70T-102-18` -> **`70T-102-18.png`**
   - For `70T-201-18` -> **`70T-201-18.png`**
3. Place them directly in this `/public/profiles/` folder, commit your changes, and push them to GitHub.
