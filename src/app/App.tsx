const workflowItems = [
  "Open an Astro project",
  "Detect content collections",
  "Edit frontmatter and Markdown",
  "Preview the Astro site",
];

export function App() {
  return (
    <main className="app-shell">
      <section className="workspace">
        <div className="intro">
          <p className="eyebrow">Orbit Editor</p>
          <h1>Astro content, edited locally.</h1>
          <p>
            Orbit Editor will open an existing Astro project, scan content
            collections, and save Markdown changes directly back to disk.
          </p>
        </div>

        <div className="panel">
          <h2>v0.1 workflow</h2>
          <ul>
            {workflowItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
