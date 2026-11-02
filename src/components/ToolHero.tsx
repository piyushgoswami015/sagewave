import Link from "next/link";
import type { ReactNode } from "react";

export default function ToolHero({
  image,
  credit,
  eyebrow,
  title,
  lede,
}: {
  image: string;
  credit: string;
  eyebrow: string;
  title: ReactNode;
  lede: string;
}) {
  return (
    <section className="page-hero">
      <div className="bg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" />
      </div>
      <div className="container">
        <div className="crumbs reveal">
          <Link href="/">Home</Link> <span>/</span> <span>{eyebrow}</span>
        </div>
        <h1 className="reveal d1">{title}</h1>
        <p className="lede reveal d2">{lede}</p>
      </div>
      <span className="photo-credit">Photo via {credit}</span>
    </section>
  );
}
