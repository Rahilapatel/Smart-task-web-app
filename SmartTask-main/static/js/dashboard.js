document.addEventListener('DOMContentLoaded', function() {
    // Initialize task status chart if it exists
    const taskStatusChartCanvas = document.getElementById('taskStatusChart');
    if (taskStatusChartCanvas) {
        initTaskStatusChart(taskStatusChartCanvas);
    }
    
    // Initialize task priority chart if it exists
    const taskPriorityChartCanvas = document.getElementById('taskPriorityChart');
    if (taskPriorityChartCanvas) {
        initTaskPriorityChart(taskPriorityChartCanvas);
    }
    
    // Initialize task timeline chart if it exists
    const taskTimelineChartCanvas = document.getElementById('taskTimelineChart');
    if (taskTimelineChartCanvas) {
        initTaskTimelineChart(taskTimelineChartCanvas);
    }
});

/**
 * Initialize the task status chart
 */
function initTaskStatusChart(canvas) {
    // Get task counts from data attributes
    const pendingTasks = parseInt(canvas.getAttribute('data-pending') || 0);
    const inProgressTasks = parseInt(canvas.getAttribute('data-in-progress') || 0);
    const completedTasks = parseInt(canvas.getAttribute('data-completed') || 0);
    const cancelledTasks = 0; // Add this when available in backend data
    
    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Pending', 'In Progress', 'Completed', 'Cancelled'],
            datasets: [{
                data: [pendingTasks, inProgressTasks, completedTasks, cancelledTasks],
                backgroundColor: [
                    '#f0ad4e',  // Warning (Pending)
                    '#5bc0de',  // Info (In Progress)
                    '#5cb85c',  // Success (Completed)
                    '#d9534f'   // Danger (Cancelled)
                ],
                borderColor: '#1e2a38',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    bodyColor: '#fff',
                    padding: 10,
                    cornerRadius: 6,
                    displayColors: true
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
}

/**
 * Initialize the task priority chart
 */
function initTaskPriorityChart(canvas) {
    const ctx = canvas.getContext('2d');
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Low', 'Medium', 'High'],
            datasets: [{
                label: 'Tasks by Priority',
                data: [3, 5, 2],
                backgroundColor: [
                    '#5cb85c',  // Low priority (Green)
                    '#f0ad4e',  // Medium priority (Orange)
                    '#d9534f'   // High priority (Red)
                ],
                borderColor: '#1e2a38',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    bodyColor: '#fff',
                    padding: 10,
                    cornerRadius: 6
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            }
        }
    });
}

/**
 * Initialize the task timeline chart
 */
function initTaskTimelineChart(canvas) {
    const ctx = canvas.getContext('2d');
    
    // Get the last 6 months
    const months = [];
    const currentDate = new Date();
    for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        months.push(monthDate.toLocaleString('default', { month: 'short' }));
    }
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Tasks Created',
                    data: [5, 8, 12, 7, 10, 15],
                    borderColor: '#5bc0de',
                    backgroundColor: 'rgba(91, 192, 222, 0.2)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#5bc0de',
                    pointBorderColor: '#fff',
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'Tasks Completed',
                    data: [3, 6, 10, 5, 8, 12],
                    borderColor: '#5cb85c',
                    backgroundColor: 'rgba(92, 184, 92, 0.2)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#5cb85c',
                    pointBorderColor: '#fff',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    bodyColor: '#fff',
                    padding: 10,
                    cornerRadius: 6
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            }
        }
    });
}
