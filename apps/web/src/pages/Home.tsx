import { Link } from "react-router";
import { LogoWall } from "../components/LogoWall";
import { TestimonialSlider } from "../components/TestimonialSlider";
import { useAuth } from "../context/AuthContext";
import { usePageTitle } from "../hooks/usePageTitle";

const FEATURES = [
  { title: "Search that keeps up", text: "Type a skill, company or role and results update as you type." },
  { title: "One-click tracking", text: "See every application and its status in one place. Withdraw any time." },
  { title: "AI CV match", text: "Paste your CV and get ranked internships with a plain-language reason for each." },
];

export default function Home() {
  usePageTitle("");
  const { user } = useAuth();
  return (
    <>
      <section className="bg-gradient-to-br from-navy to-navy-2 px-4 py-20 text-center text-white">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          Your gateway to amazing <span className="text-sky">internship</span> opportunities
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-white/80">
          Internly connects students with companies. Search, apply and track everything in one place.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/listings" className="btn-primary px-7 py-3 text-base">
            Browse internships
          </Link>
          {!user && (
            <Link to="/signup" className="btn-secondary px-7 py-3 text-base">
              Create an account
            </Link>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-16 md:grid-cols-3" aria-labelledby="features-h">
        <h2 id="features-h" className="sr-only">
          Features
        </h2>
        {FEATURES.map((f) => (
          <div key={f.title} className="card p-6">
            <h3 className="text-lg font-semibold text-navy">{f.title}</h3>
            <p className="mt-2 text-slate-600">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="bg-white px-4 py-16" aria-labelledby="partners-h">
        <h2 id="partners-h" className="mb-8 text-center text-2xl font-bold text-navy">
          Companies hiring interns
        </h2>
        <LogoWall />
      </section>

      <section className="px-4 py-16" aria-labelledby="say-h">
        <h2 id="say-h" className="mb-8 text-center text-2xl font-bold text-navy">
          What our users say
        </h2>
        <TestimonialSlider />
      </section>
    </>
  );
}
