document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const errorEl = document.getElementById("error-message");
  const submitBtn = form.querySelector("button"); // Select the button for UI updates

  // UX Improvement: Automatically focus the username field on load
  document.getElementById("username").focus();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Reset UI state
    errorEl.textContent = "";
    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const endpoint = "https://script.google.com/macros/s/AKfycbzURwLj_tTf7tZX7BIT4b6_NuU6WE64zCoGakr0zmwB1PQ695w-DLV8ksvJM9xsZ81E/exec";

    try {
      const controller = new AbortController();
      const timeoutMs = 10000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const body = new URLSearchParams({ username, password }).toString();

      const response = await fetch(endpoint, {
        method: "POST",
        mode: "cors",
        redirect: "follow", // Ensure we follow Google Apps Script redirects
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (parseErr) {
        throw new Error("Invalid response format from server.");
      }

      if (result && result.success) {
        // Success: Store user data
        sessionStorage.setItem("loggedInUser", username);
        sessionStorage.setItem("userRole", result.role || "");
        sessionStorage.setItem("fullName", result.fullName || "");
        window.location.href = "index.html";
      } else {
        // Login Failed (Wrong credentials)
        errorEl.textContent = result && result.message ? result.message : "Invalid Username or Password.";
        sessionStorage.clear(); // Safety: Clear any old data on failed attempt
      }
    } catch (err) {
      // Error handling
      console.error("Login error:", err);
      if (err.name === "AbortError") {
        errorEl.textContent = "Request timed out. Please try again.";
      } else if (!navigator.onLine) {
        errorEl.textContent = "No internet connection detected.";
      } else {
        errorEl.textContent = err.message || "An unexpected error occurred.";
      }
    } finally {
      // Always re-enable the button regardless of success or failure
      submitBtn.disabled = false;
      submitBtn.textContent = "Login";
    }
  });
});
