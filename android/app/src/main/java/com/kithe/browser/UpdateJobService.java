package com.kithe.browser;

import android.app.job.JobParameters;
import android.app.job.JobService;

public class UpdateJobService extends JobService {
    @Override
    public boolean onStartJob(final JobParameters params) {
        new Thread(() -> {
            UpdateChecker.check(getApplicationContext(), MainActivity.visible);
            jobFinished(params, false);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return false;
    }
}
