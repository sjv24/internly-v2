import { $, h } from "../dom.js";
import { initPage } from "../layout.js";
import { createSlider } from "../slider.js";

// Sample content for the demo: these are not real people.
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
const LOGOS = [
  "meta",
  "google",
  "amazon",
  "nvidia",
  "microsoft",
  "apple",
  "tesla",
  "linkedin",
  "intel",
  "ibm",
];

const user = await initPage();
if (user) $("#signup-cta").classList.add("hidden");

$("#logo-wall").replaceChildren(
  ...LOGOS.map((name) =>
    h(
      "li",
      {},
      h("img", {
        src: `/images/${name}.png`,
        alt: `${name} logo (placeholder)`,
        loading: "lazy",
        width: 96,
        height: 48,
      }),
    ),
  ),
);

createSlider($("#slider"), TESTIMONIALS);
