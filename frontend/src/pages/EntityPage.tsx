import { Link } from "react-router-dom";
import { entityConfigs } from "../entities/config";
import { AnyRecord } from "../entities/types";
import { EntityTable } from "../widgets/entity-table/EntityTable";

export function EntityPage({ name }: { name: keyof typeof entityConfigs }) {
  const config = entityConfigs[name];

  function rowLink(row: AnyRecord) {
    if (name === "uploads") return `/uploads/${row._id}/log`;
    if (name === "runs") return `/results/${row._id}`;
    if (name === "students") return `/sessions?studentId=${row._id}`;
    if (name === "sessions") return `/events?sessionId=${row._id}`;
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
