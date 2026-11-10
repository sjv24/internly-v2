// Placeholder logos for the demo (not real partners). A static array + .map() with keys.
const LOGOS = ["meta", "google", "amazon", "nvidia", "microsoft", "apple", "tesla", "linkedin", "intel", "ibm"];

export function LogoWall() {
  return (
    <div>
      {/* CSS Grid: 2 columns on phones, 5 on desktop; the browser does all the wrapping maths */}
      <ul className="mx-auto grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-5">
        {LOGOS.map((name) => (
          <li key={name} className="flex h-20 items-center justify-center rounded-xl bg-white p-4 shadow-sm">
            <img
              src={`/images/${name}.png`}
              alt={`${name} logo (placeholder)`}
              loading="lazy" // do not download until it is about to scroll into view
              width={96}
              height={48}
              className="max-h-12 w-auto object-contain"
            />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-center text-xs text-slate-400">Placeholder logos for demonstration. Not real partners.</p>
    </div>
  );
}
