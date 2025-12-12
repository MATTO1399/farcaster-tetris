@echo off
cd C:\Users\babys\farcaster-tetris-complete\farcaster-tetris

echo ===============================================
echo Deleting ALL Error deployments...
echo (Keeping only the latest 23m deployment)
echo ===============================================
echo.

echo [1/18] Deleting cfxyaf711...
echo y | vercel rm https://farcaster-tetris-cfxyaf711-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo [2/18] Deleting aomwqs54f...
echo y | vercel rm https://farcaster-tetris-aomwqs54f-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo [3/18] Deleting 1myl3v4la...
echo y | vercel rm https://farcaster-tetris-1myl3v4la-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo [4/18] Deleting kukgrf9a0...
echo y | vercel rm https://farcaster-tetris-kukgrf9a0-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo [5/18] Deleting jya0amjot...
echo y | vercel rm https://farcaster-tetris-jya0amjot-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo [6/18] Deleting f22cizyiy...
echo y | vercel rm https://farcaster-tetris-f22cizyiy-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo [7/18] Deleting 454kn4tf9...
echo y | vercel rm https://farcaster-tetris-454kn4tf9-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo [8/18] Deleting d6vgedodw...
echo y | vercel rm https://farcaster-tetris-d6vgedodw-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo [9/18] Deleting giqokcr4e...
echo y | vercel rm https://farcaster-tetris-giqokcr4e-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo [10/18] Deleting c6q243eee...
echo y | vercel rm https://farcaster-tetris-c6q243eee-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo [11/18] Deleting 1x5nc5sfg...
echo y | vercel rm https://farcaster-tetris-1x5nc5sfg-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo [12/18] Deleting fi1bh4sh0...
echo y | vercel rm https://farcaster-tetris-fi1bh4sh0-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo [13/18] Deleting 3cj556lyy...
echo y | vercel rm https://farcaster-tetris-3cj556lyy-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo [14/18] Deleting bhqji5f35...
echo y | vercel rm https://farcaster-tetris-bhqji5f35-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo [15/18] Deleting jgv2q2i78...
echo y | vercel rm https://farcaster-tetris-jgv2q2i78-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo [16/18] Deleting 6dnmlopls...
echo y | vercel rm https://farcaster-tetris-6dnmlopls-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo [17/18] Deleting hdr3s2m3y...
echo y | vercel rm https://farcaster-tetris-hdr3s2m3y-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo [18/18] Deleting qzw30n18o...
echo y | vercel rm https://farcaster-tetris-qzw30n18o-naos-projects-92a136ab.vercel.app
timeout /t 1 /nobreak >nul

echo.
echo ===============================================
echo All Error deployments deleted!
echo Only the latest deployment (23m) remains.
echo ===============================================
echo.
vercel ls
echo.
echo Press any key to exit...
pause >nul