import { color } from "../matchdayTheme";

export default function FeedIcon({ name, size = 12, tint }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: tint || color.goldLight, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "medal":
      return <svg {...common}><circle cx="12" cy="14" r="6" /><path d="M9 8L7 2M15 8l2-6" /></svg>;
    case "star":
      return <svg {...common}><path d="M12 3l2.6 5.9L21 9.6l-4.6 4.3L17.6 21 12 17.6 6.4 21l1.2-7.1L3 9.6l6.4-.7L12 3z" /></svg>;
    case "joker":
      return <svg {...common}><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 9h6M9 13h6M9 17h3" /></svg>;
    case "crown":
      return <svg {...common}><path d="M4 18h16l-1.5-9-4 3-2.5-5-2.5 5-4-3L4 18z" /></svg>;
    case "up":
      return <svg {...common}><path d="M12 19V5M6 11l6-6 6 6" /></svg>;
    case "down":
      return <svg {...common}><path d="M12 5v14M6 13l6 6 6-6" /></svg>;
    case "whistle":
      return <svg {...common}><circle cx="9" cy="15" r="5" /><path d="M14 12h6v3h-3M18 12v-3" /></svg>;
    case "stadium":
      return <svg {...common}><ellipse cx="12" cy="12" rx="9" ry="6" /><ellipse cx="12" cy="12" rx="4" ry="2.5" /></svg>;
    case "rivalry":
      return <svg {...common}><path d="M4 20l6-14M20 20l-6-14M10 6h4" /></svg>;
    case "legend":
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M6 20c1-4 4-6 6-6s5 2 6 6" /></svg>;
    case "record":
      return <svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /></svg>;
    case "academy":
      return <svg {...common}><path d="M3 9l9-5 9 5-9 5-9-5z" /><path d="M7 12v5c2 2 8 2 10 0v-5" /></svg>;
    case "fun":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></svg>;
    case "info":
    default:
      return <svg {...common}><path d="M7 4h10v4a5 5 0 01-10 0V4z" /><path d="M12 13v4M9 20h6M10 17h4" /></svg>;
  }
}
