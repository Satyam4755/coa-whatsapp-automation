import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import { FaFileExcel } from "react-icons/fa";
import { FiSearch, FiX } from "react-icons/fi";
import { BeatLoader } from "react-spinners";
import * as XLSX from "xlsx";
import api from "../../../services/api";
import {
  clearSelectedUsers,
  getSelectedUsers,
  setSelectedUsers as persistSelectedUsers,
} from "../../../utils/selectedUsers";
import { Card } from "../../ui/card";
import { EmptyState } from "../../ui/empty-state";
import { Pagination } from "../../ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";

const headers = [
  "archRegNum",
  "archName",
  "archdob",
  "archValidityUpTo",
  "Mobile",
  "Email",
];

const processRows = (rows) =>
  rows.map((row) =>
    headers.reduce((acc, header, index) => {
      acc[header] = row[index] || "";
      return acc;
    }, {})
  );

const ListOfArchitects = ({ goToNextTab }) => {
  const [selectedUsers, setSelectedUsers] = useState(() => getSelectedUsers());
  const [usersData, setUsersData] = useState([]);
  const [years, setYears] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    limit: 10,
    total: 0,
    totalCount: 0,
    totalPages: 1,
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedYear, setSelectedYear] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [uploadedRows, setUploadedRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [activeView, setActiveView] = useState("all");
  const [noDataTimer, setNoDataTimer] = useState(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await api.get("/admin/all-architects", {
          params: {
            paginate: true,
            page: currentPage,
            limit: itemsPerPage,
            search: debouncedSearchTerm,
            year: selectedYear,
          },
        });
        const payload = response.data;

        if (Array.isArray(payload)) {
          setUsersData(payload);
          setPagination({
            currentPage: 1,
            limit: payload.length || itemsPerPage,
            total: payload.length,
            totalCount: payload.length,
            totalPages: 1,
          });
        } else if (Array.isArray(payload.data)) {
          setUsersData(payload.data);
          setYears(payload.years || []);
          setPagination(payload.pagination);
        } else {
          setError("Unexpected data format received from API.");
        }
      } catch (fetchError) {
        console.error(fetchError);
        setError("Failed to fetch data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentPage, itemsPerPage, debouncedSearchTerm, selectedYear]);

  const showingUploadedRows = activeView === "uploaded";
  const showingSelectedRows = activeView === "selected";
  const visibleRows = showingUploadedRows
    ? uploadedRows
    : showingSelectedRows
      ? selectedUsers
      : usersData;
  const selectedRowKeys = selectedUsers.map((user) => user.archRegNum);
  const totalVisibleRows = showingUploadedRows
    ? uploadedRows.length
    : showingSelectedRows
      ? selectedUsers.length
    : pagination.totalCount || pagination.total || 0;
  const totalPages = pagination.totalPages || 1;
  const showInitialLoader = isLoading && !showingUploadedRows && usersData.length === 0;
  const hasActiveFilters = Boolean(selectedYear || debouncedSearchTerm);
  const pageStart =
    totalVisibleRows === 0
      ? 0
      : ((pagination.currentPage || currentPage) - 1) *
          (pagination.limit || itemsPerPage) +
        1;
  const pageEnd = Math.min(
    (pagination.currentPage || currentPage) * (pagination.limit || itemsPerPage),
    totalVisibleRows
  );

  const yearOptions = years.length ? years : [];

  useEffect(() => {
    if (!isLoading && visibleRows.length === 0 && hasActiveFilters) {
      setNoDataTimer(5);

      const countdown = setInterval(() => {
        setNoDataTimer((previousValue) => {
          if (previousValue === null || previousValue <= 1) {
            clearInterval(countdown);
            clearFilters();
            return null;
          }

          return previousValue - 1;
        });
      }, 1000);

      return () => clearInterval(countdown);
    }

    setNoDataTimer(null);
  }, [isLoading, visibleRows.length, hasActiveFilters]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) {
      alert("Please upload a valid Excel file.");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const rows = jsonData
        .slice(1)
        .filter((row) =>
          row.some((cell) => cell !== undefined && cell !== null && cell !== "")
        );

      if (rows.length === 0) {
        alert("No data found in the Excel file.");
        return;
      }

      setUploadedRows(processRows(rows));
      setActiveView("uploaded");
    };

    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Template");
    XLSX.writeFile(workbook, "architects_template.xlsx");
  };

  const clearUploadedRows = () => {
    if (uploadedRows.length > 0) {
      const uploadedRegNums = new Set(uploadedRows.map((row) => row.archRegNum));
      const nextSelectedUsers = selectedUsers.filter(
        (user) => !uploadedRegNums.has(user.archRegNum)
      );
      setSelectedUsers(nextSelectedUsers);
      if (nextSelectedUsers.length > 0) {
        persistSelectedUsers(nextSelectedUsers);
      } else {
        clearSelectedUsers();
      }
    }

    setUploadedRows([]);
    setFileName("");
    setActiveView("all");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearFilters = () => {
    setSelectedYear("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const handleUserSelect = (user) => {
    const isSelected = selectedRowKeys.includes(user.archRegNum);
    const nextSelectedUsers = isSelected
      ? selectedUsers.filter((row) => row.archRegNum !== user.archRegNum)
      : [...selectedUsers.filter((row) => row.archRegNum !== user.archRegNum), user];

    setSelectedUsers(nextSelectedUsers);
    persistSelectedUsers(nextSelectedUsers);
  };

  const handleSelectAll = () => {
    const sourceRows = showingUploadedRows ? uploadedRows : usersData;
    const nextSelectedUsers = [
      ...selectedUsers.filter(
        (row) => !sourceRows.some((user) => user.archRegNum === row.archRegNum)
      ),
      ...sourceRows,
    ];
    setSelectedUsers(nextSelectedUsers);
    persistSelectedUsers(nextSelectedUsers);
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) return;

    if (showingUploadedRows) {
      const nextUploadedRows = uploadedRows.filter(
        (user) => !selectedRowKeys.includes(user.archRegNum)
      );
      setUploadedRows(nextUploadedRows);
    } else {
      const nextUsersData = usersData.filter(
        (user) => !selectedRowKeys.includes(user.archRegNum)
      );
      setUsersData(nextUsersData);
      setPagination((previous) => ({
        ...previous,
        total: Math.max((previous.total || 0) - selectedRowKeys.length, 0),
        totalCount: Math.max((previous.totalCount || 0) - selectedRowKeys.length, 0),
      }));
    }

    clearSelection();
  };

  const clearSelection = () => {
    setSelectedUsers([]);
    clearSelectedUsers();
  };

  const handleContinueToTemplates = () => {
    if (selectedUsers.length === 0) {
      return;
    }

    persistSelectedUsers(selectedUsers);
    if (goToNextTab) {
      goToNextTab();
    }
  };

  if (showInitialLoader) {
    return (
      <div className="flex h-64 items-center justify-center">
        <BeatLoader color="#3B82F6" loading={showInitialLoader} size={15} />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="p-12 text-center">
          <p className="mb-4 text-slate-950">{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Page Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <FaFileExcel className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight tracking-tight text-slate-950">
              Architects
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {showingUploadedRows
                ? `${uploadedRows.length} uploaded rows ready for preview`
                : `${totalVisibleRows} architects in workspace`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadTemplate}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            <FaFileExcel className="h-[14px] w-[14px]" />
            Template
          </button>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="rounded-lg">
        <Card>
          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-4 border-b border-slate-200/80 p-3">
            <div className="flex min-w-[280px] flex-col gap-1.5">
              <div className="flex h-auto flex-wrap justify-start gap-1 rounded-md bg-slate-100 p-1">
                <button
                  type="button"
                  className={`rounded px-3 py-1.5 text-sm font-medium ${
                    activeView === "all"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  onClick={() => setActiveView("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`rounded px-3 py-1.5 text-sm font-medium ${
                    activeView === "uploaded"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                  onClick={() => setActiveView("uploaded")}
                >
                  Uploaded
                </button>
                {selectedRowKeys.length > 0 && (
                  <button
                    type="button"
                    className={`rounded px-3 py-1.5 text-sm font-medium ${
                      activeView === "selected"
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                    onClick={() => setActiveView("selected")}
                  >
                    {selectedRowKeys.length} selected
                  </button>
                )}
              </div>
            </div>

            <div className="w-full max-w-[520px] sm:min-w-[360px]">
              <div className="relative">
                <FiSearch className="absolute left-2 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search name, registration, mobile, email..."
                  className="!h-9 !min-h-9 w-full !pl-8 !pr-8"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setDebouncedSearchTerm("");
                      setCurrentPage(1);
                    }}
                    className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Clear search"
                  >
                    <FiX className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="w-40">
              <Select
                value={selectedYear}
                onValueChange={(value) => {
                  setSelectedYear(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Years</SelectItem>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Clear
            </button>

            <div>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Upload Excel
              </button>
            </div>
          </div>

          {/* Active Filters Chips */}
          {(hasActiveFilters || fileName) && (
            <div className="px-2 pb-2 pt-2">
              <div className="flex flex-wrap items-center gap-2">
                {debouncedSearchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setDebouncedSearchTerm("");
                      setCurrentPage(1);
                    }}
                    className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
                  >
                    Search: {debouncedSearchTerm}
                    <FiX className="h-3 w-3" />
                  </button>
                )}
                {selectedYear && (
                  <button
                    type="button"
                    onClick={() => setSelectedYear("")}
                    className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
                  >
                    Year: {selectedYear}
                    <FiX className="h-3 w-3" />
                  </button>
                )}
                {fileName && (
                  <button
                    type="button"
                    onClick={clearUploadedRows}
                    className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-700"
                  >
                    {fileName}
                    <FiX className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Mobile View */}
          <div className="block space-y-2 p-0.5 mb-4 sm:hidden">
            {visibleRows.length === 0 ? (
              showingUploadedRows ? (
                <UploadEmptyState onUpload={() => fileInputRef.current?.click()} />
              ) : (
                <EmptyState
                  title="No architects found"
                  description="Try adjusting your search or filters to find what you're looking for."
                  onReset={hasActiveFilters ? clearFilters : undefined}
                  timer={noDataTimer}
                />
              )
            ) : (
              visibleRows.map((user, index) => (
                <Card
                  key={user.archRegNum || index}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium leading-tight text-slate-950">
                        {user.archName}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">{user.archRegNum}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <span>{user.archValidityUpTo}</span>
                    <span>{user.Mobile || "N/A"}</span>
                    <span className="col-span-2 truncate">{user.Email || "N/A"}</span>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Desktop View */}
          <div className="hidden sm:block">
            <div className="relative overflow-x-auto">
              {visibleRows.length === 0 ? (
                showingUploadedRows ? (
                  <UploadEmptyState onUpload={() => fileInputRef.current?.click()} />
                ) : (
                  <EmptyState
                    title="No architects found"
                    description="Try adjusting your search or filters to find what you're looking for."
                    onReset={hasActiveFilters ? clearFilters : undefined}
                    timer={noDataTimer}
                  />
                )
              ) : (
                <Table wrapperClassName="overflow-visible">
                  <TableHeader sticky>
                    {selectedRowKeys.length > 0 ? (
                      <TableRow>
                        <TableHead className="w-12">
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={
                                selectedRowKeys.length === usersData.length &&
                                usersData.length > 0
                              }
                              onChange={(event) => {
                                if (event.target.checked) {
                                  handleSelectAll();
                                } else {
                                  clearSelection();
                                }
                              }}
                              className="h-4 w-4"
                            />
                          </div>
                        </TableHead>
                        <TableHead colSpan={6}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-slate-500">
                              {selectedRowKeys.length} architect
                              {selectedRowKeys.length > 1 ? "s" : ""} selected
                            </span>
                            {typeof goToNextTab === "function" && (
                              <button
                                type="button"
                                onClick={handleContinueToTemplates}
                                className="inline-flex h-8 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
                              >
                                Schedule
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handleBulkDelete}
                              className="inline-flex h-8 items-center justify-center rounded-md border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 hover:bg-red-100"
                            >
                              Delete Selected
                            </button>
                            <button
                              type="button"
                              onClick={clearSelection}
                              className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Clear Selection
                            </button>
                          </div>
                        </TableHead>
                      </TableRow>
                    ) : (
                      <TableRow>
                        <TableHead className="w-12">
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={
                                usersData.length > 0 &&
                                selectedRowKeys.length === usersData.length
                              }
                              onChange={(event) => {
                                if (event.target.checked) {
                                  handleSelectAll();
                                } else {
                                  clearSelection();
                                }
                              }}
                              className="h-4 w-4"
                            />
                          </div>
                        </TableHead>
                        <TableHead>Reg. No</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>DOB</TableHead>
                        <TableHead>Validity</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    )}
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((user, index) => (
                      <TableRow key={user.archRegNum || index}>
                        <TableCell className="w-12">
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={selectedRowKeys.includes(user.archRegNum)}
                              onChange={() => handleUserSelect(user)}
                              className="h-4 w-4"
                            />
                          </div>
                        </TableCell>
                        <TableCell>{user.archRegNum}</TableCell>
                        <TableCell>{user.archName}</TableCell>
                        <TableCell className="text-slate-500">{user.archdob}</TableCell>
                        <TableCell className="text-slate-500">
                          {user.archValidityUpTo}
                        </TableCell>
                        <TableCell>{user.Mobile}</TableCell>
                        <TableCell>{user.Email}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {/* Pagination */}
          {totalVisibleRows > 0 && (
            <Card className="mt-4 flex flex-col items-center justify-between gap-4 p-3 lg:flex-row">
              <div className="text-sm text-slate-500">
                {showingUploadedRows
                  ? `Showing 1 to ${visibleRows.length} of ${visibleRows.length} results`
                  : showingSelectedRows
                    ? `Showing 1 to ${visibleRows.length} of ${visibleRows.length} selected`
                  : `Showing ${pageStart} to ${pageEnd} of ${totalVisibleRows} results`}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                {!showingUploadedRows && !showingSelectedRows && (
                  <Pagination
                    currentPage={pagination.currentPage || currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    pageSize={pagination.limit || itemsPerPage}
                    onPageSizeChange={(nextPageSize) => {
                      setItemsPerPage(nextPageSize);
                      setCurrentPage(1);
                    }}
                  />
                )}

              </div>
            </Card>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ListOfArchitects;

ListOfArchitects.propTypes = {
  goToNextTab: PropTypes.func,
};

function UploadEmptyState({ onUpload }) {
  return (
    <div className="flex justify-center px-4 py-8">
      <div className="mx-auto w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 px-6 py-8 text-center">
        <div className="text-slate-500">
          <FaFileExcel className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <h3 className="text-base font-medium text-slate-900">No upload found</h3>
          <p className="mt-2 text-sm leading-6">
            Drag and drop an Excel sheet here, or upload a file to preview imported architects.
          </p>
        </div>
        <button
          type="button"
          onClick={onUpload}
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          Upload Now
        </button>
      </div>
    </div>
  );
}
