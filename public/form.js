document.getElementById('review-form').addEventListener('submit', async function(e) {
    e.preventDefault(); 
    
    const formData = new FormData(this);
    const data = {
        email: formData.get('user-email'),
        password: formData.get('user-password')
    };
    
    const messageDiv = document.getElementById('message');
    messageDiv.innerHTML = '<div class="alert alert-info">Отправка данных...</div>';
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            messageDiv.innerHTML = `<div class="alert alert-success">${result.message}</div>`;
            this.reset(); 
        } else {
            messageDiv.innerHTML = `<div class="alert alert-danger">${result.message}</div>`;
        }
    } catch (error) {
        messageDiv.innerHTML = '<div class="alert alert-danger">Ошибка соединения с сервером</div>';
        console.error('Ошибка:', error);
    }
});