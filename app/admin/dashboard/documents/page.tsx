"use client";

import { FormEvent, useEffect, useState } from "react";
import { FileUp, UploadCloud } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/admin-api";
import PageHeader from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader title="Upload Document" subtitle="Add notes, PYQs and solutions" />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-lg">
              <FileUp className="size-5 text-primary" />
              Document details
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <TaxonPicker
                label="Program*"
                options={programs}
                value={programSel}
                onValueChange={setProgramSel}
                newValue={newProgram}
                onNewValueChange={setNewProgram}
                placeholder="Select a program…"
                newPlaceholder="e.g. Diploma in Engineering"
                addLabel="Add new program…"
              />
              <TaxonPicker
                label="Faculty*"
                options={faculties}
                value={facultySel}
                onValueChange={setFacultySel}
                newValue={newFaculty}
                onNewValueChange={setNewFaculty}
                placeholder={programSel ? "Select a faculty…" : "Pick a program first"}
                newPlaceholder="e.g. Civil Engineering"
                addLabel="Add new faculty…"
                disabled={!programSel}
                // A brand-new program has no saved faculties to list yet.
                canReturnToList={programSel !== NEW}
              />
              <TaxonPicker
                label="Course*"
                options={courses}
                value={courseSel}
                onValueChange={setCourseSel}
                newValue={newCourse}
                onNewValueChange={setNewCourse}
                placeholder={facultySel ? "Select a course…" : "Pick a faculty first"}
                newPlaceholder="e.g. Engineering Mathematics I"
                addLabel="Add new course…"
                disabled={!facultySel}
                canReturnToList={facultySel !== NEW}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-title">Title*</Label>
              <Input
                id="doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Type*</Label>
                <Select value={docType} onValueChange={(v) => setDocType(String(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Period unit</Label>
                <Select
                  value={periodUnit}
                  onValueChange={(v) => setPeriodUnit(String(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="period">Period no.</Label>
                <Input
                  id="period"
                  type="number"
                  min={1}
                  max={12}
                  value={period}
                  onChange={(e) => setPeriod(Number(e.target.value))}
                  disabled={periodUnit === "none"}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-lg">
              <UploadCloud className="size-5 text-primary" />
              PDF file
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              id="pdf-input"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="cursor-pointer"
            />
            {file && (
              <p className="mt-2 text-sm text-muted-foreground">
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </CardContent>
        </Card>

        <Button type="submit" size="lg" disabled={loading} className="w-full">
          {loading ? progress || "Uploading…" : "Upload document"}
        </Button>
      </form>

      {message && (
        <Alert variant={ok ? "default" : "destructive"} className="mt-6">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * One level of the program -> faculty -> course taxonomy.
 *
 * Each level is either a picker over what already exists or, via the NEW
 * sentinel, a free-text field so an admin can onboard a value that doesn't
 * exist yet. The three levels were duplicated markup before.
 */
function TaxonPicker({
  label,
  options,
  value,
  onValueChange,
  newValue,
  onNewValueChange,
  placeholder,
  newPlaceholder,
  addLabel,
  disabled = false,
  canReturnToList = true,
}: {
  label: string;
  options: Taxon[];
  value: string;
  onValueChange: (v: string) => void;
  newValue: string;
  onNewValueChange: (v: string) => void;
  placeholder: string;
  newPlaceholder: string;
  addLabel: string;
  disabled?: boolean;
  /** False when the parent level is itself new, so there is no list to go back to. */
  canReturnToList?: boolean;
}) {
  const isNew = value === NEW;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {isNew ? (
        <div className="flex gap-2">
          <Input
            value={newValue}
            onChange={(e) => onNewValueChange(e.target.value)}
            placeholder={newPlaceholder}
            required
          />
          {canReturnToList && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="shrink-0"
              onClick={() => {
                onValueChange("");
                onNewValueChange("");
              }}
            >
              List
            </Button>
          )}
        </div>
      ) : (
        <Select
          value={value}
          onValueChange={(v) => onValueChange(String(v))}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
            <SelectItem value={NEW}>➕ {addLabel}</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
