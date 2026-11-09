/**
 * Browser bookmarklet that reads the LinkedIn profile page the *user* has
 * open and copies it as JSON to their clipboard, to be pasted into the
 * dashboard's /import page. It makes no network requests and does not crawl:
 * it only reads what is already rendered in front of the user.
 *
 * LinkedIn's markup is obfuscated and changes often, so this is best-effort:
 * it anchors on stable things (h1, section anchor ids, aria-hidden spans) and
 * the import page shows the captured JSON for review before saving.
 */
function capture() {
  const t = (el: Element | null | undefined) => (el?.textContent || "").replace(/\s+/g, " ").trim();
  const section = (id: string) => document.getElementById(id)?.closest("section") ?? null;
  const rows = (id: string) =>
    Array.from(section(id)?.querySelectorAll("li.artdeco-list__item, li") ?? [])
      .map((li) => Array.from(li.querySelectorAll("span[aria-hidden='true']")).map(t).filter(Boolean))
      .filter((r) => r.length > 0);

  const name = t(document.querySelector("h1"));
  const top = document.querySelector("main section") ?? document.body;
  const headline = t(top.querySelector(".text-body-medium"));
  const location = t(top.querySelector(".text-body-small.inline, .text-body-small"));
  const about = t(section("about")?.querySelector("span[aria-hidden='true']:not(.visually-hidden)"));
  const looksLikeDates = (s: string) => /\b(19|20)\d{2}\b|present|\bmos?\b|\byrs?\b/i.test(s);

  const experience = rows("experience").map((r) => {
    const dates = r.find(looksLikeDates) || "";
    const [from, to] = dates.split(/\s[-–]\s/);
    return {
      title: r[0],
      company: (r[1] || "").split(" · ")[0],
      from: (from || "").trim(),
      to: ((to || "").split(" · ")[0] || "").trim(),
    };
  });
  const education = rows("education").map((r) => ({
    school: r[0],
    degree: (r[1] || "").split(",")[0],
    field: (r[1] || "").split(",").slice(1).join(",").trim(),
    year: (r.find(looksLikeDates) || "").match(/(19|20)\d{2}(?!.*(19|20)\d{2})/)?.[0] || "",
  }));
  const skills = rows("skills").map((r) => r[0]).filter(Boolean);
  const avatar = (document.querySelector("img.pv-top-card-profile-picture__image--show, img.evi-image") as HTMLImageElement | null)?.src;

  const profile = {
    profileUrl: location_href(),
    fullName: name,
    headline,
    location,
    summary: about,
    avatarUrl: avatar,
    skills,
    experience,
    education,
    capturedBy: "bookmarklet",
    capturedAt: new Date().toISOString(),
  };
  const json = JSON.stringify(profile, null, 2);
  const done = () => alert("Profile copied (" + (name || "unknown") + "). Paste it on the dashboard's Import page.");
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(json).then(done, () => prompt("Copy this JSON:", json));
  else prompt("Copy this JSON:", json);

  function location_href() {
    return window.location.href.split("?")[0];
  }
}

/** The `javascript:` URL to drag to the bookmarks bar. */
export function bookmarkletHref(): string {
  return "javascript:(" + encodeURIComponent(capture.toString()) + ")()";
}

export const bookmarkletSource = capture.toString();
