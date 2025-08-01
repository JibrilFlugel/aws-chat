import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Chat from "./Chat";
import { useState } from "react";
import { TextField, Typography } from "@mui/material";
import * as React from "react";
import Button from "@mui/material/Button";
import DeleteIcon from "@mui/icons-material/Delete";
import LoadingSpinner from "./Spinner";
import IconButton from "@mui/material/IconButton";
import SendIcon from "@mui/icons-material/Send";

const App = (props) => {
  const [history, setHistory] = useState([]);
  const [question, setQuestion] = useState("");
  const [spinner, setSpinner] = useState(false);
  const [sessionId, setSessionId] = useState(undefined);

  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  const handleSendQuestion = () => {
    setSpinner(true);

    fetch(baseUrl + "docs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestSessionId: sessionId,
        question: question,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("data", data);
        setSpinner(false);
        setSessionId(data.sessionId);
        setHistory([
          ...history,
          {
            question: question,
            response: data.response,
            citation: data.citation,
          },
        ]);
      })
      .catch((err) => {
        setSpinner(false);
        setHistory([
          ...history,
          {
            question: question,
            response:
              "Error generating an answer. Please check your browser console/network in dev mode, Bedrock model access, and Lambda logs.",
            citation: undefined,
          },
        ]);
      });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSendQuestion();
    }
  };

  const onClearHistory = () => setHistory([]);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        padding: "30px",
        backgroundColor: "#f0f0f0",
      }}
    >
      <Paper
        sx={{
          padding: 8,
          maxWidth: 600,
        }}
      >
        <Typography variant="h5" sx={{ textAlign: "center" }}>
          AWS Q&A
        </Typography>
        <br></br>
        <br></br>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            height: "100%",
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: "10px",
              paddingTop: "20px",
            }}
          >
            <Typography variant="overline">Ask a question:</Typography>
            <Button
              disabled={history.length === 0}
              startIcon={<DeleteIcon />}
              onClick={onClearHistory}
            >
              Clear History
            </Button>
          </Box>
          <Chat history={history} />
          <br></br>
          {spinner ? (
            <Box sx={{ justifyContent: "center", padding: "20px" }}>
              <LoadingSpinner />
            </Box>
          ) : (
            <br></br>
          )}
        </Box>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "20px",
            paddingTop: "20px",
          }}
        >
          <TextField
            disabled={spinner || !baseUrl}
            variant="standard"
            label="Enter your question here"
            value={question}
            onChange={(e) => setQuestion(e.target?.value)}
            onKeyDown={handleKeyDown}
            sx={{ width: "95%" }}
          />
          <IconButton
            disabled={spinner || !baseUrl}
            onClick={handleSendQuestion}
            color="primary"
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>
    </Box>
  );
};

export default App;
