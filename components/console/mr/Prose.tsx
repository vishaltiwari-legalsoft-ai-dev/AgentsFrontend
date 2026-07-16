"use client";

import { proseBlocks } from "./proseBlocks";

/** Renders an agent narrative as discrete blocks — paragraphs, bullet findings
 *  and pipe tables. Shared by the report doc and the Ask answer card; the parsing
 *  itself lives in ./prose so it stays under test. */
export function Prose({ text }: { text: string }) {
  return (
    <div className="mr-doc__prosewrap">
      {proseBlocks(text).map((b, i) => {
        if (b.kind === "ul") {
          return (
            <ul className="mr-doc__list" key={i}>
              {b.items.map((item, j) => <li key={j}>{item}</li>)}
            </ul>
          );
        }
        if (b.kind === "table") {
          return (
            <table className="mr-table" key={i}>
              <tbody>
                {b.rows.map((r, j) => (
                  <tr key={j}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          );
        }
        return <p className="mr-doc__prose" key={i}>{b.text}</p>;
      })}
    </div>
  );
}
