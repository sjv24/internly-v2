import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { Listing } from "@internly/shared";
import { ListingCard } from "../components/ListingCard";
import { ListingList } from "../components/ListingList";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { SearchBar } from "../components/SearchBar";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";

// ProtectedRoute reads the logged-in user from context; we mock the hook to test each situation.
vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));

const listing: Listing = {
  id: 7,
  companyId: 1,
  companyName: "Acme",
  title: "Frontend Intern",
  description: '<img src=x onerror="alert(1)"> Build things',
  location: "Dubai",
  workType: "remote",
  duration: "3 months",
  stipend: "",
  skills: ["React"],
  openings: 1,
  startDate: null,
  deadline: null,
  createdAt: "2026-01-01T00:00:00Z",
};

const renderInRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("ListingCard", () => {
  it("renders listing data and links to the detail page", () => {
    renderInRouter(<ListingCard listing={listing} />);
    expect(screen.getByRole("link", { name: "Frontend Intern" })).toHaveAttribute("href", "/listings/7");
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Remote")).toBeInTheDocument();
  });

  it("shows HTML in a description as plain text instead of executing it (XSS)", () => {
    const { container } = renderInRouter(<ListingCard listing={listing} />);
    expect(container.querySelector("img")).toBeNull(); // no element was created from the text
    expect(screen.getByText(/onerror/)).toBeInTheDocument(); // it is displayed literally
  });
});

describe("ListingList states", () => {
  const noop = () => {};
  it("shows an empty state", () => {
    renderInRouter(<ListingList listings={[]} loading={false} fetching={false} error={null} onRetry={noop} />);
    expect(screen.getByText(/No internships match/)).toBeInTheDocument();
  });

  it("shows an error with a working retry button", async () => {
    const onRetry = vi.fn();
    const err = Object.assign(new Error("Cannot reach the server"), { status: 0, code: "network_error" });
    renderInRouter(
      <ListingList listings={undefined} loading={false} fetching={false} error={err as never} onRetry={onRetry} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Cannot reach the server");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("SearchBar", () => {
  it("calls onSearch once, after the user stops typing", async () => {
    const onSearch = vi.fn();
    render(<SearchBar value="" onSearch={onSearch} delayMs={150} />);
    await userEvent.type(screen.getByRole("searchbox"), "react");
    expect(onSearch).not.toHaveBeenCalled(); // typing is instant, searching is not
    await vi.waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1), { timeout: 1500 });
    expect(onSearch).toHaveBeenCalledWith("react");
  });
});

describe("StatusBadge", () => {
  it("renders a label for each status", () => {
    render(
      <>
        <StatusBadge status="pending" />
        <StatusBadge status="accepted" />
        <StatusBadge status="rejected" />
      </>,
    );
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });
});

function renderRoute(role: "student" | "company") {
  return render(
    <MemoryRouter initialEntries={["/secret"]}>
      <Routes>
        <Route element={<ProtectedRoute role={role} />}>
          <Route path="/secret" element={<p>secret page</p>} />
        </Route>
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
const auth = (user: unknown, loading = false) => vi.mocked(useAuth).mockReturnValue({ user, loading } as never);

describe("ProtectedRoute", () => {
  it("redirects anonymous visitors to /login", () => {
    auth(null);
    renderRoute("student");
    expect(screen.getByText("login page")).toBeInTheDocument();
  });

  it("lets the right role in", () => {
    auth({ id: 1, role: "student", name: "S", email: "s@x.dev" });
    renderRoute("student");
    expect(screen.getByText("secret page")).toBeInTheDocument();
  });

  it("blocks the wrong role", () => {
    auth({ id: 2, role: "company", name: "C", email: "c@x.dev" });
    renderRoute("student");
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
    expect(screen.getByText(/for student accounts/)).toBeInTheDocument();
  });

  it("shows a spinner while the session is being checked", () => {
    auth(null, true);
    renderRoute("student");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
