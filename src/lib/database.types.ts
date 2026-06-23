// 수기 작성한 Supabase 스키마 타입.
// 목적: .from(...) insert/update 시 "없는 컬럼 / NOT NULL 누락"을 컴파일 단계에서 잡는다.
// jsonb(settings/recent_matches)와 uuid[] 은 동적이라 느슨하게 둔다(컬럼 단위 검증이 핵심).
// DB 스키마가 바뀌면 이 파일도 갱신할 것. (information_schema 로 확인한 실제 컬럼 기준)

export type Json = string | number | boolean | null | { [key: string]: any } | any[];

type StudentRow = {
  id: string;
  class_id: string | null;
  student_name: string;
  rp: number | null;
  tier: string | null;
  win_count: number | null;
  lose_count: number | null;
  is_deleted: boolean | null;
  recent_matches: any;
  real_name: string | null;
  nickname: string | null;
  student_no: number | null;
  grade: number | null;
  class_number: number | null;
  gender: string | null;
  display_name: string | null;
  last_match_date: string | null;
  last_win_date: string | null;
  title: string | null;
};

type MatchRow = {
  id: string;
  class_id: string | null;
  winner_id: string | null;
  loser_id: string | null;
  winner2_id: string | null;
  loser2_id: string | null;
  winner_score: number | null;
  loser_score: number | null;
  season: string | null;
  created_at: string | null;
};

type ClassRow = {
  id: string;
  season_id: string | null;
  owner_uid: string | null;
  co_admin_uids: string[] | null;
  scorekeeper_uids: string[] | null;
  class_name: string | null;
  settings: any;
  is_deleted: boolean | null;
  created_at: string | null;
};

type ClassSecretRow = {
  class_id: string;
  admin_code: string;
};

type StudentSecretRow = {
  student_id: string;
};

export type Database = {
  public: {
    Tables: {
      students: {
        Row: StudentRow;
        // student_name 은 NOT NULL(기본값 없음) → insert 시 필수. 나머지는 선택.
        Insert: { student_name: string } & Partial<StudentRow>;
        Update: Partial<StudentRow>;
        Relationships: [];
      };
      matches: {
        Row: MatchRow;
        Insert: { id?: string } & Partial<MatchRow>;
        Update: Partial<MatchRow>;
        Relationships: [];
      };
      classes: {
        Row: ClassRow;
        Insert: { id?: string } & Partial<ClassRow>;
        Update: Partial<ClassRow>;
        Relationships: [];
      };
      class_secrets: {
        Row: ClassSecretRow;
        Insert: ClassSecretRow;
        Update: Partial<ClassSecretRow>;
        Relationships: [];
      };
      student_secrets: {
        Row: StudentSecretRow;
        Insert: StudentSecretRow;
        Update: Partial<StudentSecretRow>;
        Relationships: [];
      };
    };
    Views: {
      students_public: {
        Row: Omit<StudentRow, "real_name">;
      };
    };
    Functions: { [key: string]: never };
    Enums: { [key: string]: never };
    CompositeTypes: { [key: string]: never };
  };
};

// 쓰기(insert/update) 페이로드에 직접 붙여 "없는 컬럼 / NOT NULL 누락"을 컴파일에서 잡는 별칭.
// 사용 예: const row: StudentInsert = {...}; supabase.from("students").insert(row);
export type StudentInsert = Database["public"]["Tables"]["students"]["Insert"];
export type StudentUpdate = Database["public"]["Tables"]["students"]["Update"];
export type MatchInsert = Database["public"]["Tables"]["matches"]["Insert"];
export type MatchUpdate = Database["public"]["Tables"]["matches"]["Update"];
export type ClassInsert = Database["public"]["Tables"]["classes"]["Insert"];
export type ClassUpdate = Database["public"]["Tables"]["classes"]["Update"];
export type ClassSecretInsert = Database["public"]["Tables"]["class_secrets"]["Insert"];
export type ClassSecretUpdate = Database["public"]["Tables"]["class_secrets"]["Update"];
