const PAGE_SIZE = 1000

type RangeQuery<T> = (
  from: number,
  to: number
) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/**
 * Fetches every row from a Supabase query by paginating in batches of 1000,
 * bypassing the default 1000-row cap.
 *
 * Usage:
 *   const { data, error } = await fetchAll((from, to) =>
 *     supabase.schema("telas").from("cabecera").select("*").range(from, to)
 *   )
 */
export async function fetchAll<T>(
  queryFn: RangeQuery<T>
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const all: T[] = []
  let offset = 0

  while (true) {
    const { data, error } = await queryFn(offset, offset + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return { data: all, error: null }
}
