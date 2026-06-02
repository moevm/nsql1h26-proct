import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../../widgets/layout/AppLayout";
import { BackupPage } from "../../pages/BackupPage";
import { ClusterHistoryPage } from "../../pages/ClusterHistoryPage";
import { ClusteringPage } from "../../pages/ClusteringPage";
import { EntityDetailsPage } from "../../pages/EntityDetailsPage";
import { EntityPage } from "../../pages/EntityPage";
import { LoginPage } from "../../pages/LoginPage";
import { ProcessingLogDetailsPage } from "../../pages/ProcessingLogDetailsPage";
import { ProcessingPage } from "../../pages/ProcessingPage";
import { ReportsPage } from "../../pages/ReportsPage";
import { ResultsPage } from "../../pages/ResultsPage";
import { StatisticsPage } from "../../pages/StatisticsPage";
import { UploadLogPage } from "../../pages/UploadLogPage";
import { UploadHistoryPage } from "../../pages/UploadHistoryPage";
import { UploadsPage } from "../../pages/UploadsPage";
import { ProtectedRoute, RoleGuard, RootRedirect } from "./ProtectedRoute";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/uploads" element={<UploadsPage />} />
          <Route path="/upload" element={<UploadsPage />} />
          <Route path="/upload-history" element={<UploadHistoryPage />} />
          <Route path="/upload-history/:id" element={<UploadLogPage />} />
          <Route path="/uploads/:uploadId/log" element={<UploadLogPage />} />
          <Route path="/uploads/:id" element={<EntityDetailsPage name="uploads" />} />
          <Route path="/students" element={<EntityPage name="students" />} />
          <Route path="/students/:id" element={<EntityDetailsPage name="students" />} />
          <Route path="/sessions" element={<EntityPage name="sessions" />} />
          <Route path="/sessions/:id" element={<EntityDetailsPage name="sessions" />} />
          <Route path="/events" element={<EntityPage name="events" />} />
          <Route path="/events/:id" element={<EntityDetailsPage name="events" />} />
          <Route path="/processing" element={<ProcessingPage />} />
          <Route path="/processing/log/:uploadId/:entryIndex" element={<ProcessingLogDetailsPage />} />
          <Route path="/clustering" element={<ClusteringPage />} />
          <Route path="/clustering-runs" element={<EntityPage name="runs" />} />
          <Route path="/clustering-runs/:id" element={<EntityDetailsPage name="runs" />} />
          <Route path="/cluster-history" element={<ClusterHistoryPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/results/:runId" element={<ResultsPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/backup" element={<RoleGuard roles={["admin"]}><BackupPage /></RoleGuard>} />
          <Route path="/users" element={<RoleGuard roles={["admin"]}><EntityPage name="users" /></RoleGuard>} />
          <Route path="/users/:id" element={<RoleGuard roles={["admin"]}><EntityDetailsPage name="users" /></RoleGuard>} />
          <Route path="/universities" element={<RoleGuard roles={["admin"]}><EntityPage name="universities" /></RoleGuard>} />
          <Route path="/universities/:id" element={<RoleGuard roles={["admin"]}><EntityDetailsPage name="universities" /></RoleGuard>} />
          <Route path="/audit" element={<RoleGuard roles={["admin"]}><EntityPage name="audit" /></RoleGuard>} />
          <Route path="/audit/:id" element={<RoleGuard roles={["admin"]}><EntityDetailsPage name="audit" /></RoleGuard>} />
          <Route path="/settings" element={<div className="flex items-center justify-center h-64 text-muted-foreground">Settings page coming soon</div>} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
