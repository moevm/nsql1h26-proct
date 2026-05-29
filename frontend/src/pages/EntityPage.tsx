import { Link } from "react-router-dom";
import { entityConfigs } from "../entities/config";
import { AnyRecord } from "../entities/types";
import { EntityTable } from "../widgets/entity-table/EntityTable";

export function EntityPage({ name }: { name: keyof typeof entityConfigs }) {
  const config = entityConfigs[name];

  function rowLink(row: AnyRecord) {
    if (name === "uploads") return `/uploads/${row._id}`;
    if (name === "runs") return `/clustering-runs/${row._id}`;
    if (name === "students") return `/students/${row._id}`;
    if (name === "sessions") return `/sessions/${row._id}`;
    if (name === "events") return `/events/${row._id}`;
    if (name === "users") return `/users/${row._id}`;
    if (name === "universities") return `/universities/${row._id}`;
    if (name === "audit") return `/audit/${row._id}`;
    return undefined;
  }

  return (
    <>
      {name === "uploads" && (
        <div className="page-actions">
          <Link className="button" to="/processing">
            Перейти к обработке
          </Link>
        </div>
      )}
      <EntityTable config={config} rowLink={rowLink} />
    </>
  );
}
