# Selenium Testing Results

The automated Selenium tests have been successfully executed. Below is the summary of the test flow and the captured figures.

## Test Script: `selenium_test.py`

This script automates the following steps:
1.  **Signup**: Creates a unique test user.
2.  **Login**: Fills the login form and takes a screenshot.
3.  **Dashboard**: Verifies the dashboard loads and takes a screenshot.
4.  **Scrolling**: Scrolls the dashboard and captures the view.
5.  **Resume Upload**: Navigates to the interview area, uploads `test.pdf`, and verifies the upload.

## Captured Figures

````carousel
![Figure 5: Login form filled with credentials](/Figure_5_Login_form_filled.png)
<!-- slide -->
![Figure 7: Dashboard loaded after successful login](/Figure_7_Dashboard_loaded.png)
<!-- slide -->
![Figure 8: Page scrolled showing additional content](/Figure_8_Page_scrolled.png)
<!-- slide -->
![Figure 6: Resume uploaded successfully](/Figure_6_Resume_uploaded.png)
````

## Terminal Output

Below is the visual screenshot of the terminal during the test execution, along with the raw log output.

![Terminal Screenshot](/terminal_screenshot_1777102981923.png)

### Raw Logs
```text
Starting Selenium Tests...
Navigating to Signup: http://localhost:5173/signup
Finding signup inputs...
Entering credentials for testuser_1777101217...
Signup button clicked.
Waiting for redirect to login...
Filling login form...
Captured Figure 5: Login form filled
Waiting for Dashboard to load...
Captured Figure 7: Dashboard loaded
Captured Figure 8: Page scrolled
Navigating to Interview Area...
Waiting for file input...
Uploading D:\AI-Interview-Simulator\AI-Interview-Assistant\test.pdf...
Captured Figure 6: Resume uploaded successfully
Selenium Tests Completed.
```

## How to Run the Tests Manually

1.  Ensure both the **Backend** and **Frontend** are running.
2.  Execute the following command in the project root:
    ```bash
    python selenium_test.py
    ```
    The screenshots will be saved in the `screenshots/` directory.

> [!TIP]
> The script uses a headless Chrome browser by default. If you want to see the browser in action, you can remove the `--headless=new` option in `selenium_test.py`.
