import javax.microedition.midlet.*;
import javax.microedition.lcdui.*;
import javax.microedition.io.*;
import java.io.*;

public class TrainTracker extends MIDlet implements CommandListener {

    private Display display;
    
    // UI Components
    private List mainMenu;
    private Form urlForm;
    private TextField serverUrlField;
    private String serverUrl = "http://fosiji4635.eu.pythonanywhere.com";
    
    // Live Status Form
    private Form liveForm;
    private TextField liveTrainNoField;
    private StringItem liveResultItem;
    
    // Search Stations Form
    private Form searchForm;
    private TextField searchFromField;
    private TextField searchToField;
    private StringItem searchResultItem;
    
    // Schedule Form
    private Form scheduleForm;
    private TextField scheduleTrainNoField;
    private StringItem scheduleResultItem;
    
    // Commands
    private Command exitCommand;
    private Command backCommand;
    private Command saveUrlCommand;
    private Command fetchLiveCommand;
    private Command fetchSearchCommand;
    private Command fetchScheduleCommand;

    public TrainTracker() {
        display = Display.getDisplay(this);
        
        // Commands
        exitCommand = new Command("Exit", Command.EXIT, 1);
        backCommand = new Command("Back", Command.BACK, 1);
        saveUrlCommand = new Command("Save", Command.OK, 1);
        fetchLiveCommand = new Command("Track", Command.OK, 1);
        fetchSearchCommand = new Command("Search", Command.OK, 1);
        fetchScheduleCommand = new Command("Schedule", Command.OK, 1);
        
        // URL Settings Form (runs first)
        urlForm = new Form("Server Setup");
        serverUrlField = new TextField("Server URL:", serverUrl, 100, TextField.URL);
        urlForm.append(serverUrlField);
        urlForm.addCommand(saveUrlCommand);
        urlForm.addCommand(exitCommand);
        urlForm.setCommandListener(this);
        
        // Main Menu
        mainMenu = new List("Train Tracker", Choice.IMPLICIT);
        mainMenu.append("1. Live Train Status", null);
        mainMenu.append("2. Search Stations", null);
        mainMenu.append("3. Train Schedule", null);
        mainMenu.append("4. Change Server URL", null);
        mainMenu.addCommand(exitCommand);
        mainMenu.setCommandListener(this);
        
        // Live Status Form
        liveForm = new Form("Live Status");
        liveTrainNoField = new TextField("Train No:", "", 10, TextField.NUMERIC);
        liveResultItem = new StringItem("Result:\n", "");
        liveForm.append(liveTrainNoField);
        liveForm.append(liveResultItem);
        liveForm.addCommand(fetchLiveCommand);
        liveForm.addCommand(backCommand);
        liveForm.setCommandListener(this);
        
        // Search Stations Form
        searchForm = new Form("Search Trains");
        searchFromField = new TextField("From (Name):", "", 20, TextField.ANY);
        searchToField = new TextField("To (Name):", "", 20, TextField.ANY);
        searchResultItem = new StringItem("Result:\n", "");
        searchForm.append(searchFromField);
        searchForm.append(searchToField);
        searchForm.append(searchResultItem);
        searchForm.addCommand(fetchSearchCommand);
        searchForm.addCommand(backCommand);
        searchForm.setCommandListener(this);
        
        // Schedule Form
        scheduleForm = new Form("Train Schedule");
        scheduleTrainNoField = new TextField("Train No:", "", 10, TextField.NUMERIC);
        scheduleResultItem = new StringItem("Result:\n", "");
        scheduleForm.append(scheduleTrainNoField);
        scheduleForm.append(scheduleResultItem);
        scheduleForm.addCommand(fetchScheduleCommand);
        scheduleForm.addCommand(backCommand);
        scheduleForm.setCommandListener(this);
    }

    protected void startApp() {
        display.setCurrent(urlForm);
    }

    protected void pauseApp() {}

    protected void destroyApp(boolean unconditional) {}

    public void commandAction(Command c, Displayable d) {
        if (c == exitCommand) {
            destroyApp(false);
            notifyDestroyed();
        } else if (c == backCommand) {
            display.setCurrent(mainMenu);
        } else if (c == saveUrlCommand) {
            serverUrl = serverUrlField.getString();
            if (serverUrl.endsWith("/")) serverUrl = serverUrl.substring(0, serverUrl.length() - 1);
            display.setCurrent(mainMenu);
        } else if (c == List.SELECT_COMMAND && d == mainMenu) {
            int selected = mainMenu.getSelectedIndex();
            if (selected == 0) {
                liveResultItem.setText("");
                display.setCurrent(liveForm);
            } else if (selected == 1) {
                searchResultItem.setText("");
                display.setCurrent(searchForm);
            } else if (selected == 2) {
                scheduleResultItem.setText("");
                display.setCurrent(scheduleForm);
            } else if (selected == 3) {
                display.setCurrent(urlForm);
            }
        } else if (c == fetchLiveCommand) {
            String tNo = liveTrainNoField.getString();
            if (tNo.length() > 0) {
                liveResultItem.setText("Fetching live status...\n");
                fetchData(serverUrl + "/api/track?trainNo=" + tNo, liveResultItem);
            }
        } else if (c == fetchSearchCommand) {
            String from = searchFromField.getString();
            String to = searchToField.getString();
            if (from.length() > 0 && to.length() > 0) {
                searchResultItem.setText("Searching trains...\n");
                fetchData(serverUrl + "/api/search_stations?from=" + from + "&to=" + to, searchResultItem);
            }
        } else if (c == fetchScheduleCommand) {
            String tNo = scheduleTrainNoField.getString();
            if (tNo.length() > 0) {
                scheduleResultItem.setText("Fetching schedule...\n");
                fetchData(serverUrl + "/api/schedule?trainNo=" + tNo, scheduleResultItem);
            }
        }
    }

    private void fetchData(final String url, final StringItem resultUI) {
        Thread t = new Thread() {
            public void run() {
                HttpConnection hc = null;
                InputStream is = null;
                try {
                    // Extremely basic URL encoding for spaces in station names
                    String safeUrl = url;
                    StringBuffer sbUrl = new StringBuffer();
                    for(int i=0; i<safeUrl.length(); i++) {
                        char ch = safeUrl.charAt(i);
                        if(ch == ' ') sbUrl.append("%20");
                        else sbUrl.append(ch);
                    }
                    
                    String currentUrl = sbUrl.toString();
                    int maxRedirects = 3;
                    int redirectCount = 0;
                    
                    while (redirectCount < maxRedirects) {
                        resultUI.setText("Connecting... (" + (redirectCount + 1) + ")");
                        
                        hc = (HttpConnection) Connector.open(currentUrl);
                        
                        // Bypass ngrok's browser warning page
                        hc.setRequestProperty("ngrok-skip-browser-warning", "true");
                        // Bypass Localtunnel's warning page (legacy support)
                        hc.setRequestProperty("bypass-tunnel-reminder", "true");
                        hc.setRequestProperty("User-Agent", "TrainTrackerApp/1.0");
                        hc.setRequestMethod(HttpConnection.GET);
                        
                        int rc = hc.getResponseCode();
                        
                        // Handle redirects (301, 302, 307, 308)
                        if (rc == 301 || rc == 302 || rc == 307 || rc == 308) {
                            String newUrl = hc.getHeaderField("Location");
                            if (newUrl != null) {
                                // Close current connection before following redirect
                                try { hc.close(); } catch (Exception ignored) {}
                                hc = null;
                                currentUrl = newUrl;
                                redirectCount++;
                                continue;
                            } else {
                                resultUI.setText("Redirect error: no Location header");
                                return;
                            }
                        }
                        
                        if (rc == HttpConnection.HTTP_OK) {
                            is = hc.openInputStream();
                            int ch;
                            StringBuffer sb = new StringBuffer();
                            while ((ch = is.read()) != -1) {
                                sb.append((char) ch);
                            }
                            resultUI.setText(sb.toString());
                        } else {
                            resultUI.setText("HTTP Error " + rc);
                        }
                        return; // Done, exit the loop
                    }
                    
                    resultUI.setText("Too many redirects");
                    
                } catch (Exception e) {
                    resultUI.setText("Error: " + e.getMessage());
                } finally {
                    try {
                        if (is != null) is.close();
                        if (hc != null) hc.close();
                    } catch (Exception ignored) {}
                }
            }
        };
        t.start();
    }
}
