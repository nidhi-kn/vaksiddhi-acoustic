import { useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { raised } from "./lib";
import { PageTitle, AnalysesTable, Empty, Modal } from "./components";
export default function HistoryPage({ items, onSelect, onDelete }) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [confirm, setConfirm] = useState(false);
  const filtered = items.filter(
    (x) =>
      x.audio_file.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "all" || (filter === "alert" ? raised(x) : !raised(x))),
  );
  return (
    <>
      <PageTitle
        eyebrow="YOUR RECORDS"
        title="Analysis history"
        text="Saved result metadata, kept in this browser."
      />
      <div className="history-toolbar">
        <label className="search">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recordings"
            aria-label="Search recordings"
          />
        </label>
        <select
          aria-label="Filter results"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All results</option>
          <option value="alert">Spoof alerts</option>
          <option value="below">Below threshold</option>
        </select>
        <button
          className="button secondary"
          disabled={!items.length}
          onClick={() => setConfirm(true)}
        >
          <Trash2 size={16} /> Clear history
        </button>
      </div>
      <section className="recent">
        {filtered.length ? (
          <AnalysesTable items={filtered} onSelect={onSelect} />
        ) : (
          <Empty
            title={
              items.length ? "No matching recordings" : "No analyses saved yet"
            }
            text={
              items.length
                ? "Try a different search or result filter."
                : "Completed results will be saved here automatically."
            }
          />
        )}
      </section>
      <p className="caption">
        Up to 200 results are retained. Audio files are never stored in history.
      </p>
      {confirm && (
        <Modal title="Clear local history?" onClose={() => setConfirm(false)}>
          <p>This removes all saved result metadata from this browser.</p>
          <button
            className="button"
            onClick={() => {
              onDelete();
              setConfirm(false);
            }}
          >
            <Trash2 size={16} /> Clear history
          </button>
        </Modal>
      )}
    </>
  );
}
