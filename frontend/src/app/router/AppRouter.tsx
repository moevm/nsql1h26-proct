import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../../widgets/layout/AppLayout";
import { BackupPage } from "../../pages/BackupPage";
import { ClusterHistoryPage } from "../../pages/ClusterHistoryPage";
import { ClusteringPage } from "../../pages/ClusteringPage";
import { EntityPage } from "../../pages/EntityPage";
import { LoginPage } from "../../pages/LoginPage";
import { ProcessingPage } from "../../pages/ProcessingPage";
import { ReportsPage } from "../../pages/ReportsPage";
import { ResultsPage } from "../../pages/ResultsPage";
import { UploadLogPage } from "../../pages/UploadLogPage";
import { UploadHistoryPage } from "../../pages/UploadHistoryPage";
import { UploadsPage } from "../../pages/UploadsPage";
import { ProtectedRoute, RootRedirect } from "./ProtectedRoute";

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
          <Route path="/students" element={<EntityPage name="students" />} />
          <Route path="/sessions" element={<EntityPage name="sessions" />} />
          <Route path="/events" element={<EntityPage name="events" />} />
          <Route path="/processing" element={<ProcessingPage />} />
          <Route path="/clustering" element={<ClusteringPage />} />
          <Route path="/clustering-runs" element={<EntityPage name="runs" />} />
          <Route path="/cluster-history" element={<ClusterHistoryPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/results/:runId" element={<ResultsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/backup" element={<BackupPage />} />
          <Route path="/users" element={<EntityPage name="users" />} />
          <Route path="/universities" element={<EntityPage name="universities" />} />
          <Route path="/audit" element={<EntityPage name="audit" />} />
          <Route path="/settings" element={<div className="flex items-center justify-center h-64 text-muted-foreground">Settings page coming soon</div>} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
