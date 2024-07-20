const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const port = 45624;
const DB_FILE = '/var/lib/taskgen-db'; // Adjust the path if necessary

app.use(bodyParser.json());

// Enable CORS for all routes
app.use(cors());

// Helper function to read the database
function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    return [];
  }
  const data = fs.readFileSync(DB_FILE, 'utf8');
  return data.split('\n').filter(line => line.trim()).map(line => line.split(':'));
}

// Endpoint to list tasks
app.get('/tasks', (req, res) => {
  exec('sudo taskgen --list', (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: stderr.trim() });
    }
    const tasksRaw = stdout.trim().split('\n').slice(1);
    const tasks = tasksRaw.map(task => {
      const [name, command, frequency, timerOptions] = task.split(':');
      return { name, command, frequency, timerOptions };
    });
    res.json(tasks);
  });
});

// Endpoint to create a task
app.post('/tasks', (req, res) => {
  const { name, command, frequency, timer_options: timerOptions } = req.body;
  const tasks = readDb();
  if (tasks.some(task => task[0] === name)) {
    return res.status(400).json({ error: 'Task with this name already exists' });
  }
  const cmd = `sudo taskgen --name ${name} --command "${command}" --frequency ${frequency} --operation create`;
  if (timerOptions) {
    cmd += ` --timer-options ${timerOptions}`;
  }
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: stderr.trim() });
    }
    res.json({ detail: 'Task created successfully' });
  });
});

// Endpoint to delete a task
app.delete('/tasks', (req, res) => {
  const { name } = req.body;
  const tasks = readDb();
  if (!tasks.some(task => task[0] === name)) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const cmd = `sudo taskgen --name ${name} --operation delete`;
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ error: stderr.trim() });
    }
    res.json({ detail: 'Task deleted successfully' });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
