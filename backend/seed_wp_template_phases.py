"""
Recreate the WordPress Site Build template with phase values on production.
The old template was deleted. This creates a new one with phases.
"""
import requests

API_BASE = "https://vertex-api-smg3.onrender.com"

tasks = [
    # Discovery & Planning (6)
    {"title": "Client questionnaire (goals, audience, competitors, brand guidelines)", "priority": "high", "phase": "Discovery & Planning"},
    {"title": "Gather all assets (logo, brand colors, fonts, copy, images)", "priority": "high", "phase": "Discovery & Planning"},
    {"title": "Define sitemap and page structure", "priority": "high", "phase": "Discovery & Planning"},
    {"title": "Wireframe key pages", "priority": "high", "phase": "Discovery & Planning"},
    {"title": "Agree on timeline and milestones", "priority": "high", "phase": "Discovery & Planning"},
    {"title": "Purchase/configure hosting and domain", "priority": "high", "phase": "Discovery & Planning"},
    # Setup & Environment (7)
    {"title": "Install WordPress", "priority": "high", "phase": "Setup & Environment"},
    {"title": "Set up staging/dev environment", "priority": "high", "phase": "Setup & Environment"},
    {"title": "Install SSL certificate", "priority": "high", "phase": "Setup & Environment"},
    {"title": "Set timezone, permalink structure, and general settings", "priority": "medium", "phase": "Setup & Environment"},
    {"title": "Remove default posts, pages, and plugins", "priority": "medium", "phase": "Setup & Environment"},
    {"title": "Install and activate theme (or Bricks Builder)", "priority": "high", "phase": "Setup & Environment"},
    {"title": "Set up global styles (colors, typography, spacing, buttons)", "priority": "high", "phase": "Setup & Environment"},
    # Theme & Design (6)
    {"title": "Create header and footer templates", "priority": "high", "phase": "Theme & Design"},
    {"title": "Set up responsive breakpoints", "priority": "medium", "phase": "Theme & Design"},
    {"title": "Install SEO plugin (Rank Math or Yoast)", "priority": "medium", "phase": "Theme & Design"},
    {"title": "Install security plugin (Wordfence or Solid Security)", "priority": "medium", "phase": "Theme & Design"},
    {"title": "Install caching/performance plugin (WP Rocket, LiteSpeed Cache)", "priority": "medium", "phase": "Theme & Design"},
    {"title": "Install backup solution (UpdraftPlus, BlogVault)", "priority": "medium", "phase": "Theme & Design"},
    # Homepage Build (6)
    {"title": "Install forms plugin (WPForms, Fluent Forms)", "priority": "medium", "phase": "Homepage Build"},
    {"title": "Install image optimization plugin (ShortPixel, Smush)", "priority": "medium", "phase": "Homepage Build"},
    {"title": "Install client-specific plugins (WooCommerce, booking, etc.)", "priority": "medium", "phase": "Homepage Build"},
    {"title": "Build Homepage", "priority": "high", "phase": "Homepage Build"},
    {"title": "Build About page", "priority": "high", "phase": "Homepage Build"},
    {"title": "Build Services/Products pages", "priority": "high", "phase": "Homepage Build"},
    # Inner Pages (7)
    {"title": "Build Contact page (with working form + Google Maps if needed)", "priority": "high", "phase": "Inner Pages"},
    {"title": "Build Blog/News page + single post template", "priority": "high", "phase": "Inner Pages"},
    {"title": "Build additional pages (portfolio, FAQ, testimonials, etc.)", "priority": "medium", "phase": "Inner Pages"},
    {"title": "Build 404 page", "priority": "medium", "phase": "Inner Pages"},
    {"title": "Build Privacy Policy and Terms pages", "priority": "medium", "phase": "Inner Pages"},
    {"title": "Add all copy/text content", "priority": "high", "phase": "Inner Pages"},
    {"title": "Upload and optimize images (proper naming, alt text)", "priority": "medium", "phase": "Inner Pages"},
    # Blog & Dynamic Content (6)
    {"title": "Embed videos if needed", "priority": "low", "phase": "Blog & Dynamic Content"},
    {"title": "Set up blog categories and tags", "priority": "medium", "phase": "Blog & Dynamic Content"},
    {"title": "Add sample/initial blog posts if applicable", "priority": "low", "phase": "Blog & Dynamic Content"},
    {"title": "Configure SEO plugin settings", "priority": "high", "phase": "Blog & Dynamic Content"},
    {"title": "Set meta titles and descriptions for all pages", "priority": "high", "phase": "Blog & Dynamic Content"},
    {"title": "Set up Open Graph/social sharing images", "priority": "medium", "phase": "Blog & Dynamic Content"},
    # Forms & Functionality (7)
    {"title": "Create and submit XML sitemap", "priority": "high", "phase": "Forms & Functionality"},
    {"title": "Add schema markup where relevant", "priority": "medium", "phase": "Forms & Functionality"},
    {"title": "Set canonical URLs", "priority": "medium", "phase": "Forms & Functionality"},
    {"title": "Configure robots.txt", "priority": "medium", "phase": "Forms & Functionality"},
    {"title": "Enable caching", "priority": "high", "phase": "Forms & Functionality"},
    {"title": "Minify CSS/JS", "priority": "medium", "phase": "Forms & Functionality"},
    {"title": "Lazy load images", "priority": "medium", "phase": "Forms & Functionality"},
    # SEO & Performance (6)
    {"title": "Check Core Web Vitals (PageSpeed Insights, GTmetrix)", "priority": "high", "phase": "SEO & Performance"},
    {"title": "Optimize database", "priority": "medium", "phase": "SEO & Performance"},
    {"title": "Set up CDN if needed", "priority": "low", "phase": "SEO & Performance"},
    {"title": "Change default login URL", "priority": "high", "phase": "SEO & Performance"},
    {"title": "Limit login attempts", "priority": "high", "phase": "SEO & Performance"},
    {"title": "Set strong admin credentials", "priority": "high", "phase": "SEO & Performance"},
    # Security & Compliance (6)
    {"title": "Disable file editing in dashboard", "priority": "medium", "phase": "Security & Compliance"},
    {"title": "Set up automated backups", "priority": "high", "phase": "Security & Compliance"},
    {"title": "Update all plugins/themes to latest versions", "priority": "high", "phase": "Security & Compliance"},
    {"title": "Test all forms (submissions actually arrive)", "priority": "high", "phase": "Security & Compliance"},
    {"title": "Test all links (no broken links)", "priority": "high", "phase": "Security & Compliance"},
    {"title": "Check responsiveness on mobile, tablet, desktop", "priority": "high", "phase": "Security & Compliance"},
    # Testing & QA (7)
    {"title": "Cross-browser testing (Chrome, Safari, Firefox, Edge)", "priority": "high", "phase": "Testing & QA"},
    {"title": "Check loading speed", "priority": "high", "phase": "Testing & QA"},
    {"title": "Proofread all content", "priority": "high", "phase": "Testing & QA"},
    {"title": "Test 404 page", "priority": "medium", "phase": "Testing & QA"},
    {"title": "Check favicon is set", "priority": "medium", "phase": "Testing & QA"},
    {"title": "Verify analytics/tracking codes (GA4, GTM, Meta Pixel)", "priority": "high", "phase": "Testing & QA"},
    {"title": "Test social sharing previews", "priority": "medium", "phase": "Testing & QA"},
    # Launch (7)
    {"title": "Check accessibility basics (contrast, alt text, keyboard nav)", "priority": "medium", "phase": "Launch"},
    {"title": "Point domain to hosting (DNS update)", "priority": "high", "phase": "Launch"},
    {"title": "Switch from staging to live", "priority": "high", "phase": "Launch"},
    {"title": "Re-check SSL on live domain", "priority": "high", "phase": "Launch"},
    {"title": "Submit sitemap to Google Search Console", "priority": "high", "phase": "Launch"},
    {"title": "Set up Google Search Console and Bing Webmaster Tools", "priority": "high", "phase": "Launch"},
    {"title": "Disable Discourage search engines in WP settings", "priority": "high", "phase": "Launch"},
    # Post-Launch & Handover (7)
    {"title": "Final smoke test on live site", "priority": "high", "phase": "Post-Launch & Handover"},
    {"title": "Send client handover document (logins, how-to guide)", "priority": "high", "phase": "Post-Launch & Handover"},
    {"title": "Train client on basic edits (adding posts, updating content)", "priority": "high", "phase": "Post-Launch & Handover"},
    {"title": "Set up uptime monitoring", "priority": "medium", "phase": "Post-Launch & Handover"},
    {"title": "Schedule regular backups", "priority": "high", "phase": "Post-Launch & Handover"},
    {"title": "Plan ongoing maintenance (updates, security scans)", "priority": "medium", "phase": "Post-Launch & Handover"},
    {"title": "Collect testimonial/feedback from client", "priority": "medium", "phase": "Post-Launch & Handover"},
]

# Add order to each task
for i, task in enumerate(tasks):
    task["order"] = i

payload = {
    "name": "WordPress Site Build",
    "description": "Full WordPress website build from discovery to post-launch handover",
    "tasks": tasks,
}

print(f"Creating template with {len(tasks)} tasks across {len(set(t['phase'] for t in tasks))} phases...")
resp = requests.post(f"{API_BASE}/api/project-templates/", json=payload, timeout=120)
if resp.status_code == 201:
    result = resp.json()
    print(f"Success! Template id={result['id']} with {len(result['tasks'])} tasks")
    phases = set(t.get("phase") for t in result["tasks"] if t.get("phase"))
    print(f"Phases: {', '.join(sorted(phases))}")
else:
    print(f"Error: {resp.status_code} {resp.text}")
