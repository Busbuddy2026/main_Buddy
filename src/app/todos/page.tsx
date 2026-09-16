import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export default async function Page() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: todos, error } = await supabase.from("todos").select();

  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-lg font-semibold">Todos</h1>
        <p className="mt-2 text-red-600">Supabase error: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-lg font-semibold">Todos</h1>
      <ul className="mt-2 list-disc pl-5">
        {todos?.map((todo) => (
          <li key={todo.id}>{todo.name}</li>
        ))}
      </ul>
    </main>
  );
}
