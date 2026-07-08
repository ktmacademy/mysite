"use client";

import { FormEvent, useEffect, useState } from "react";
import { FileUp, UploadCloud } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";

// doc_type doubles as the storage bucket name (notes / pyqs / solutions).
const DOC_TYPES = [
  { value: "notes", label: "Notes" },
  { value: "pyqs", label: "Past Questions (PYQs)" },
  { value: "solutions", label: "Solutions" },
];

const PERIOD_UNITS = [
  { value: "semester", label: "Semester" },
  { value: "year", label: "Year" },
  { value: "none", label: "None" },
];

// Sentinel select value that flips a taxonomy field to a free-text input so an
// admin can still onboard a program/faculty/course that doesn't exist yet.
const NEW = "__new__";

interface Taxon {
  id: string;
  name: string;
}

export default function DocumentsPage() {
  // Taxonomy pulled from the DB (anon SELECT is allowed on these tables).
  const [programs, setPrograms] = useState<Taxon[]>([]);
  const [faculties, setFaculties] = useState<Taxon[]>([]);
  const [courses, setCourses] = useState<Taxon[]>([]);

  // Current pick at each level: an id, the NEW sentinel, or "" (unset).
  const [programSel, setProgramSel] = useState("");
  const [facultySel, setFacultySel] = useState("");
  const [courseSel, setCourseSel] = useState("");

  // Free-text names used when the matching level is in "add new" mode.
  const [newProgram, setNewProgram] = useState("");
  const [newFaculty, setNewFaculty] = useState("");
  const [newCourse, setNewCourse] = useState("");

  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("notes");
  const [periodUnit, setPeriodUnit] = useState("semester");
  const [period, setPeriod] = useState(1);
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  // Load all programs once.
  useEffect(() => {
    (async () => {
      const { data } = await getSupabase()
        .from("programs")
        .select("id, name")
        .order("sort_order")
        .order("name");
      setPrograms((data as Taxon[]) ?? []);
    })();
  }, []);

  // When the program changes, fetch its faculties and reset the deeper levels.
  useEffect(() => {
    setFaculties([]);
    setCourses([]);
    // A brand-new program has no children yet, so cascade into "add new".
    setFacultySel(programSel === NEW ? NEW : "");
    if (!programSel || programSel === NEW) return;
    (async () => {
      const { data } = await getSupabase()
        .from("faculties")
        .select("id, name")
        .eq("program_id", programSel)
        .order("sort_order")
        .order("name");
      setFaculties((data as Taxon[]) ?? []);
    })();
  }, [programSel]);

  // When the faculty changes, fetch its courses and reset the course.
  useEffect(() => {
    setCourses([]);
    setCourseSel(facultySel === NEW ? NEW : "");
    if (!facultySel || facultySel === NEW) return;
    (async () => {
      const { data } = await getSupabase()
        .from("courses")
        .select("id, name")
        .eq("faculty_id", facultySel)
        .order("sort_order")
        .order("name");
      setCourses((data as Taxon[]) ?? []);
    })();
  }, [facultySel]);

  // Effective names sent to the API. getOrCreate on the server handles rows
  // that don't exist yet, so a typed-in "new" name works exactly as before.
  const nameOf = (list: Taxon[], sel: string, fresh: string) =>
    sel === NEW ? fresh.trim() : list.find((t) => t.id === sel)?.name ?? "";
  const program = nameOf(programs, programSel, newProgram);
  const faculty = nameOf(faculties, facultySel, newFaculty);
  const course = nameOf(courses, courseSel, newCourse);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    setOk(false);

    if (!program.trim() || !faculty.trim() || !course.trim() || !title.trim()) {
      setMessage("Program, faculty, course and title are required.");
      return;
    }
    if (!file) {
      setMessage("Please choose a PDF file.");
      return;
    }
    if (file.type !== "application/pdf") {
      setMessage("Only PDF files are allowed.");
      return;
    }

    setLoading(true);
    const bucket = docType;

    try {
      // 1. Ask the server for a signed upload URL (keeps folder structure).
      const storagePath =
        `${program.trim()}/${faculty.trim()}/${course.trim()}/` +
        `${title.trim()}_${Date.now()}.pdf`;

      setProgress("Requesting upload URL...");
      const { path, token } = await adminFetch<{ path: string; token: string }>(
        "/api/admin/upload-url",
        { bucket, path: storagePath }
      );

      // 2. Upload the PDF straight to Supabase Storage from the browser.
      setProgress("Uploading file...");
      const { error: uploadError } = await getSupabase()
        .storage.from(bucket)
        .uploadToSignedUrl(path, token, file, { contentType: "application/pdf" });
      if (uploadError) throw new Error(uploadError.message);

      // 3. Record metadata (creates program/faculty/course as needed).
      setProgress("Saving record...");
      await adminFetch("/api/admin/documents", {
        program,
        faculty,
        course,
        title,
        docType,
        periodUnit,
        period: periodUnit === "none" ? null : Number(period),
        bucket,
        path,
      });

      setOk(true);
      setMessage("Document uploaded successfully!");
      setTitle("");
      setFile(null);
      (document.getElementById("pdf-input") as HTMLInputElement | null)?.value &&
        ((document.getElementById("pdf-input") as HTMLInputElement).value = "");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  const inputClass =
    "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none";

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader title="Upload Document" subtitle="Add notes, PYQs and solutions" />

      <div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-3 mb-6">
              <FileUp className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Document Details
              </h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Program*
                  </label>
                  {programSel === NEW ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProgram}
                        onChange={(e) => setNewProgram(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. Diploma in Engineering"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setProgramSel("");
                          setNewProgram("");
                        }}
                        className="shrink-0 rounded-lg border border-gray-300 px-3 text-sm text-gray-600 hover:bg-gray-50"
                      >
                        List
                      </button>
                    </div>
                  ) : (
                    <select
                      value={programSel}
                      onChange={(e) => setProgramSel(e.target.value)}
                      className={inputClass}
                      required
                    >
                      <option value="">Select a program…</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                      <option value={NEW}>➕ Add new program…</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Faculty*
                  </label>
                  {facultySel === NEW ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newFaculty}
                        onChange={(e) => setNewFaculty(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. Civil"
                        required
                      />
                      {programSel !== NEW && (
                        <button
                          type="button"
                          onClick={() => {
                            setFacultySel("");
                            setNewFaculty("");
                          }}
                          className="shrink-0 rounded-lg border border-gray-300 px-3 text-sm text-gray-600 hover:bg-gray-50"
                        >
                          List
                        </button>
                      )}
                    </div>
                  ) : (
                    <select
                      value={facultySel}
                      onChange={(e) => setFacultySel(e.target.value)}
                      className={`${inputClass} disabled:bg-gray-100`}
                      required
                      disabled={!programSel}
                    >
                      <option value="">
                        {programSel ? "Select a faculty…" : "Pick a program first"}
                      </option>
                      {faculties.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                      <option value={NEW}>➕ Add new faculty…</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course*
                  </label>
                  {courseSel === NEW ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCourse}
                        onChange={(e) => setNewCourse(e.target.value)}
                        className={inputClass}
                        placeholder="e.g. Engineering Mathematics I"
                        required
                      />
                      {facultySel !== NEW && (
                        <button
                          type="button"
                          onClick={() => {
                            setCourseSel("");
                            setNewCourse("");
                          }}
                          className="shrink-0 rounded-lg border border-gray-300 px-3 text-sm text-gray-600 hover:bg-gray-50"
                        >
                          List
                        </button>
                      )}
                    </div>
                  ) : (
                    <select
                      value={courseSel}
                      onChange={(e) => setCourseSel(e.target.value)}
                      className={`${inputClass} disabled:bg-gray-100`}
                      required
                      disabled={!facultySel}
                    >
                      <option value="">
                        {facultySel ? "Select a course…" : "Pick a faculty first"}
                      </option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                      <option value={NEW}>➕ Add new course…</option>
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title*
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                  placeholder="Document title"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type*
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className={inputClass}
                  >
                    {DOC_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Period Unit
                  </label>
                  <select
                    value={periodUnit}
                    onChange={(e) => setPeriodUnit(e.target.value)}
                    className={inputClass}
                  >
                    {PERIOD_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Period No.
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={period}
                    onChange={(e) => setPeriod(Number(e.target.value))}
                    disabled={periodUnit === "none"}
                    className={`${inputClass} disabled:bg-gray-100`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <UploadCloud className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">PDF File</h2>
            </div>
            <input
              id="pdf-input"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
            />
            {file && (
              <p className="text-sm text-gray-500 mt-2">
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? progress || "Uploading..." : "Upload Document"}
          </button>
        </form>

        {message && (
          <div
            className={`mt-6 rounded-lg p-4 ${
              ok
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
