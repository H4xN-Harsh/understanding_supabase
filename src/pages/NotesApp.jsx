import { useEffect, useState } from "react";
import { Plus, Trash2, Pin, PinOff, X, Check, Search } from "lucide-react";
import { supabase } from "../../src/supabase";

const COLORS = [
  { name: "manila", bg: "#F3E7C9", tape: "#E8D9A8" },
  { name: "sage", bg: "#DCE6D5", tape: "#C7D6BC" },
  { name: "sky", bg: "#D9E6EE", tape: "#C2D8E4" },
  { name: "blush", bg: "#F1DCDC", tape: "#E6C4C4" },
];

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotesApp() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: "", body: "", color: COLORS[0].name });
  const [isCreating, setIsCreating] = useState(false);

  // READ — initial fetch
  useEffect(() => {
    fetchNotes();
  }, []);

  async function fetchNotes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) console.error("Error fetching notes:", error);
    else setNotes(data);
    setLoading(false);
  }

  const colorOf = (name) => COLORS.find((c) => c.name === name) || COLORS[0];

  function startCreate() {
    setDraft({ title: "", body: "", color: COLORS[Math.floor(Math.random() * COLORS.length)].name });
    setIsCreating(true);
    setEditingId(null);
  }

  function startEdit(note) {
    setDraft({ title: note.title, body: note.body, color: note.color });
    setEditingId(note.id);
    setIsCreating(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setIsCreating(false);
  }

  // CREATE + UPDATE
  async function saveNote() {
    if (!draft.title.trim() && !draft.body.trim()) {
      cancelEdit();
      return;
    }

    if (isCreating) {
      const { data, error } = await supabase
        .from("notes")
        .insert({
          title: draft.title.trim() || "Untitled",
          body: draft.body.trim(),
          color: draft.color,
        })
        .select()
        .single();

      if (error) console.error("Error creating note:", error);
      else setNotes((prev) => [data, ...prev]);
    } else if (editingId) {
      const { data, error } = await supabase
        .from("notes")
        .update({
          title: draft.title.trim() || "Untitled",
          body: draft.body.trim(),
          color: draft.color,
        })
        .eq("id", editingId)
        .select()
        .single();

      if (error) console.error("Error updating note:", error);
      else setNotes((prev) => prev.map((n) => (n.id === editingId ? data : n)));
    }
    cancelEdit();
  }

  // DELETE
  async function deleteNote(id, e) {
    e.stopPropagation();
    const prev = notes;
    setNotes((p) => p.filter((n) => n.id !== id)); // optimistic
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) {
      console.error("Error deleting note:", error);
      setNotes(prev); // roll back
    }
    if (editingId === id) cancelEdit();
  }

  // UPDATE (pin toggle)
  async function togglePin(id, e) {
    e.stopPropagation();
    const note = notes.find((n) => n.id === id);
    const { data, error } = await supabase
      .from("notes")
      .update({ pinned: !note.pinned })
      .eq("id", id)
      .select()
      .single();

    if (error) console.error("Error toggling pin:", error);
    else setNotes((prev) => prev.map((n) => (n.id === id ? data : n)));
  }

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(query.toLowerCase()) ||
      n.body.toLowerCase().includes(query.toLowerCase())
  );
  const pinned = filtered.filter((n) => n.pinned);
  const unpinned = filtered.filter((n) => !n.pinned);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#EFEAE0] flex items-center justify-center text-stone-500 text-sm">
        Loading notes...
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#EFEAE0] text-stone-800">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <header className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Notes</h1>
            <p className="text-sm text-stone-500 mt-0.5">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-300 bg-white/70 text-sm outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent placeholder:text-stone-400"
            />
          </div>
        </header>

        {pinned.length > 0 && (
          <Section label="Pinned">
            <Grid>
              {pinned.map((n) => (
                <Card
                  key={n.id}
                  note={n}
                  color={colorOf(n.color)}
                  onClick={() => startEdit(n)}
                  onDelete={(e) => deleteNote(n.id, e)}
                  onPin={(e) => togglePin(n.id, e)}
                />
              ))}
            </Grid>
          </Section>
        )}

        <Section label={pinned.length > 0 ? "Others" : "All notes"}>
          <Grid>
            <button
              onClick={startCreate}
              className="group h-40 rounded-md border-2 border-dashed border-stone-300 hover:border-stone-400 hover:bg-white/50 transition-colors flex flex-col items-center justify-center gap-2 text-stone-400 hover:text-stone-600"
            >
              <Plus className="w-6 h-6" />
              <span className="text-sm font-medium">New note</span>
            </button>
            {unpinned.map((n) => (
              <Card
                key={n.id}
                note={n}
                color={colorOf(n.color)}
                onClick={() => startEdit(n)}
                onDelete={(e) => deleteNote(n.id, e)}
                onPin={(e) => togglePin(n.id, e)}
              />
            ))}
          </Grid>
          {filtered.length === 0 && query && (
            <p className="text-sm text-stone-400 mt-6">No notes match "{query}".</p>
          )}
        </Section>
      </div>

      {(isCreating || editingId) && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center p-6 z-50"
          onClick={cancelEdit}
        >
          <div
            className="w-full max-w-md rounded-lg shadow-xl p-5 flex flex-col gap-3"
            style={{ backgroundColor: colorOf(draft.color).bg }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Title"
              className="bg-transparent text-lg font-semibold outline-none placeholder:text-stone-500/60"
            />
            <textarea
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              placeholder="Write something..."
              rows={6}
              className="bg-transparent text-sm outline-none resize-none placeholder:text-stone-500/60 leading-relaxed"
            />
            <div className="flex items-center justify-between pt-2 border-t border-black/10">
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setDraft((d) => ({ ...d, color: c.name }))}
                    className="w-6 h-6 rounded-full border-2"
                    style={{
                      backgroundColor: c.bg,
                      borderColor: draft.color === c.name ? "#57534e" : "transparent",
                    }}
                    aria-label={c.name}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-stone-600 hover:bg-black/5"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={saveNote}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm bg-stone-800 text-white hover:bg-stone-900"
                >
                  <Check className="w-4 h-4" /> Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">{label}</h2>
      {children}
    </div>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">{children}</div>;
}

function Card({ note, color, onClick, onDelete, onPin }) {
  return (
    <div
      onClick={onClick}
      className="group relative h-40 rounded-md p-4 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col"
      style={{ backgroundColor: color.bg }}
    >
      <div
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-4 rounded-sm opacity-80 rotate-1"
        style={{ backgroundColor: color.tape }}
      />
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm text-stone-800 line-clamp-1 pr-1">{note.title}</h3>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onPin} className="p-1 rounded hover:bg-black/10" aria-label="Pin">
            {note.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-black/10 text-rose-700" aria-label="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <p className="text-xs text-stone-600 mt-1.5 line-clamp-4 whitespace-pre-wrap leading-relaxed">
        {note.body}
      </p>
      <span className="mt-auto pt-2 text-[10px] text-stone-500/80">{formatDate(note.updated_at)}</span>
    </div>
  );
}