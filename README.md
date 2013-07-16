# Friend Memos

Save memos about your Facebook friends to note down where and how you met them, or just any miscellaneous notes you wish to take down regarding any friend in particular.

## Setup instructions (localhost)

Install Redis and node and run redis-server (port 6379)

Make a copy of start.example

```
$ cp start.example start
```

Edit YOUR_FB_APP_ID, YOUR_FB_APP_SECRET, FIREBASE_APP_URL and FIREBASE_APP_SECRET in "start" to match your Facebook and Firebase App details



Make "start" executable

```
$ chmod +x start
```

Install grunt-cli

```
npm install -g grunt-cli
```

Run the application

```
$ ./start
```

Goto http://locahost:3000 in your web browser to start using app.


## Setup instructions (Heroku)

First, login to heroku.

```
$ heroku login 
```

Then execute the following commands:

```
$ heroku create
$ heroku addons:add rediscloud:20
$ heroku config:set NODE_ENV=production
```

Configure your Facebook App variables and hostname.
```
$ heroku config:set FACEBOOK_APP_ID="your-app-id"
$ heroku config:set FACEBOOK_APP_SECRET="your-app-secret"
$ heroku config:set FIREBASE_APP_URL="your-app-url"
$ heroku config:set FIREBASE_APP_SECRET=""your-app-secret"
$ heroku config:set HOSTNAME="http://your-heroku-app-hostname"
```

Deploy your App.

```
$ git push heroku master
```

Open the app in your browser.

```
heroku open
```
