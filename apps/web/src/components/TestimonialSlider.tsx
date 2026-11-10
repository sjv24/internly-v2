import { useEffect, useState } from "react";
import { initials } from "../lib/format";

// Sample content for the demo - these are not real people.
const TESTIMONIALS = [
  {
    name: "Aron R.",
    role: "Marketing Intern",
    quote: "Internly helped me find an internship that matched my skills in under a week.",
  },
  {
    name: "Joana D.",
    role: "Software Intern",
    quote: "The process was smooth and tracking my applications in one place was a huge relief.",
  },
  {
    name: "John S.",
    role: "Business Analyst Intern",
    quote: "I started my career with confidence and clarity. Applying took minutes.",
  },
];

const INTERVAL_MS = 5000;

export function TestimonialSlider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance. The classic useEffect interview question: the interval MUST be cleared in the
  // cleanup function, otherwise every re-run/unmount leaves a zombie timer behind (a memory leak).
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (paused || reduceMotion) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % TESTIMONIALS.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="What our users say (sample testimonials)"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="mx-auto max-w-2xl text-center"
    >
      <div className="relative min-h-44">
        {TESTIMONIALS.map((t, i) => (
          <figure
            key={t.name}
            aria-hidden={i !== index}
            className={`fade-slide absolute inset-0 flex flex-col items-center ${i === index ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-lg font-bold text-white"
              aria-hidden
            >
              {initials(t.name)}
            </div>
            <blockquote className="mt-4 text-lg italic text-slate-700">“{t.quote}”</blockquote>
            <figcaption className="mt-2 text-sm font-semibold text-navy">
              {t.name}, {t.role}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-2">
        {TESTIMONIALS.map((t, i) => (
          <button
            key={t.name}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show testimonial ${i + 1} of ${TESTIMONIALS.length}`}
            aria-current={i === index}
            className={`h-3 w-3 rounded-full ${i === index ? "bg-brand" : "bg-slate-300 hover:bg-slate-400"}`}
          />
        ))}
      </div>
    </section>
  );
}
