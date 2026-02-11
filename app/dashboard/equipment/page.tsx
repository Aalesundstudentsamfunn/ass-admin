import Link from "next/link"
import GroupCard from "./_groupcard"
import { createClient } from "@/lib/supabase/server"

export default async function EquipmentPage() {
  const supabase = await createClient();
  const groups = await supabase.from('activity_group').select('*')
  return (

    <div>
      <section>
        <div>
          <h3 className="italic">Denne siden er under utvikling, please kom med tilbakemeldinger</h3>
        </div>
      </section>
      <section>
        <h1 className="">        for å se alt av utstyr klikk <Link href="/dashboard/equipment/all" className="underline">her</Link>
        </h1>
      </section>
      <section>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 p-10">
          {groups.data?.map((group) => {
            return (
              <li key={group.id} className="mb-4">
                <GroupCard id={group.id} name={group.name} description={group.description || ""} group_leader={group.group_leader || "ingen leder"} eq_ammount={0} />
              </li>
            )
          })}
        </ul>
      </section>
    </div>

  )
}