"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Skill } from "@/lib/types";
import { isAllowedFile } from "@/lib/client";

export default function Composer({
  streaming,
  onSend,
  onCancel,
}: {
  streaming: boolean;
  onSend: (text: string, files: File[]) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [showSkills, setShowSkills] = useState(false);
  const [skillFilter, setSkillFilter] = useState("");
  const [highlight, setHighlight] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => setSkills((d.skills || []).filter((s: Skill) => !s.isDisabled)))
      .catch(() => setSkills([]));
  }, []);

  const filteredSkills = useMemo(() => {
    if (!skills) return [];
    const q = skillFilter.toLowerCase();
    return skills.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
  }, [skills, skillFilter]);

  // "/" at the start of the input opens the skills autocomplete; the text after
  // it filters the list.
  const syncSkillPopover = (value: string) => {
    if (value.startsWith("/")) {
      setShowSkills(true);
      setSkillFilter(value.slice(1));
      setHighlight(0);
    } else {
      setShowSkills(false);
      setSkillFilter("");
    }
  };

  const insertSkill = (skill: Skill) => {
    setText(`Use the ${skill.name} skill: `);
    setShowSkills(false);
    textarea.current?.focus();
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const accepted: File[] = [];
    for (const f of Array.from(list)) {
      if (!isAllowedFile(f.name)) {
        alert(`"${f.name}" has an unsupported extension.`);
        continue;
      }
      accepted.push(f);
    }
    setFiles((prev) => [...prev, ...accepted].slice(0, 10));
  };

  const submit = () => {
    const q = text.trim();
    if (!q || streaming) return;
    onSend(q, files);
    setText("");
    setFiles([]);
    setShowSkills(false);
  };

  return (
    <div className="relative border-t border-slate-200 bg-white p-4">
      {showSkills && (
        <div className="absolute bottom-full left-4 right-4 mb-2 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Skills {skills === null && "(loading…)"}
          </div>
          {filteredSkills.length === 0 && skills !== null && (
            <div className="px-3 py-2 text-sm text-slate-400">No matching skills</div>
          )}
          {filteredSkills.map((s, i) => (
            <button
              key={s.name}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${i === highlight ? "bg-slate-100" : ""}`}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => insertSkill(s)}
            >
              <span className="font-mono font-medium text-slate-800">/{s.name}</span>
              {s.isBuiltin && <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">built-in</span>}
              <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{s.description}</div>
            </button>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
              📎 {f.name}
              <button className="text-slate-400 hover:text-slate-700" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <button
          className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          title="Attach files (csv, pdf, xlsx, …)"
          onClick={() => fileInput.current?.click()}
        >
          📎
        </button>
        <button
          className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
          title="Browse skills"
          onClick={() => { setShowSkills((v) => !v); setSkillFilter(""); }}
        >
          ⚡
        </button>
        <textarea
          ref={textarea}
          className="max-h-40 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          rows={2}
          placeholder='Ask about your data… (type "/" for skills)'
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            syncSkillPopover(e.target.value);
          }}
          onKeyDown={(e) => {
            if (showSkills && filteredSkills.length > 0) {
              if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filteredSkills.length - 1)); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); return; }
              if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertSkill(filteredSkills[highlight]); return; }
              if (e.key === "Escape") { setShowSkills(false); return; }
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {streaming ? (
          <button className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700" onClick={onCancel}>
            Stop
          </button>
        ) : (
          <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40" disabled={!text.trim()} onClick={submit}>
            Send
          </button>
        )}
      </div>
    </div>
  );
}
